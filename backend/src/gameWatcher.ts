import { parseEther } from 'ethers'
import { CONFIG } from './config'
import { botWallet, provider, getBotContract } from './chainClient'
import { hashCommit } from './hashing'
import { decideMove, getCurrentMove, clearMove } from './botLogic'

const PHASES = ['idle', 'commit', 'reveal', 'finished'] as const

// Set BOT_AUTO_RESTART=false if you want the bot to wait forever after a match finishes.
const AUTO_RESTART = process.env.BOT_AUTO_RESTART !== 'false'

// How long the finished/result screen should remain visible before auto-restarting.
const parsedResultViewMs = Number(process.env.RESULT_VIEW_MS ?? 15000)
const RESULT_VIEW_MS = Number.isFinite(parsedResultViewMs)
  ? parsedResultViewMs
  : 15000

let watching = false
let hasStaked = false
let hasCommitted = false
let hasRevealed = false
let stakingInFlight = false
let nextStakeAttemptAt = 0
let nextTimeoutAttemptAt = 0
let interval: ReturnType<typeof setInterval> | null = null

// If the user clicks VS Bot while the game is finished, allow immediate restart.
let nextMatchRequested = false

// When the bot first sees phase === 'finished', store the time.
let finishedObservedAt: number | null = null

async function readBigInt(call: () => Promise<any>): Promise<bigint | null> {
  try {
    const value = await call()
    return BigInt(value)
  } catch {
    return null
  }
}

async function getStakeAmount(): Promise<bigint> {
  const contract: any = getBotContract()

  const onchainRequiredStake = await readBigInt(() => contract.requiredStake())

  if (onchainRequiredStake !== null && onchainRequiredStake > 0n) {
    return onchainRequiredStake
  }

  const fallback = parseEther(CONFIG.stakeAmountEth)

  if (fallback > 0n) {
    return fallback
  }

  throw new Error(
    'Could not determine a stake amount from requiredStake() or STAKE_AMOUNT_ETH'
  )
}

async function readPlayerState(address: string): Promise<any | null> {
  try {
    const contract: any = getBotContract()
    return await contract.players(address)
  } catch {
    return null
  }
}

async function syncStateFromChain(): Promise<void> {
  const botAddress = await botWallet.getAddress()
  const me = await readPlayerState(botAddress)

  if (!me) return

  if (me.hasStaked) hasStaked = true
  if (me.hasCommitted) hasCommitted = true
  if (me.hasRevealed) hasRevealed = true
}

async function stakeToGame(): Promise<void> {
  const contract: any = getBotContract()

  const amount = await getStakeAmount()

  console.log('[bot] staking amount:', amount.toString())

  const botAddress = await botWallet.getAddress()
  const balance = await provider.getBalance(botAddress)

  if (balance < amount) {
    throw new Error(
      `Bot balance too low. Required: ${amount.toString()}, available: ${balance.toString()}`
    )
  }

  const tx = await contract.stake({ value: amount })
  await tx.wait()
}

async function tick() {
  try {
    const contract: any = getBotContract()

    const phaseRaw = await contract.gamePhase()
    const phase = PHASES[Number(phaseRaw)] ?? 'idle'

    console.log(
      `[bot] tick -> phase: ${phase} | staked: ${hasStaked} | committed: ${hasCommitted} | revealed: ${hasRevealed}`
    )

    const latestBlock = await provider.getBlock('latest')
    const chainNow = latestBlock?.timestamp ?? Math.floor(Date.now() / 1000)

    if (phase === 'finished') {
      if (finishedObservedAt === null) {
        finishedObservedAt = Date.now()

        console.log(
          `[bot] match finished. Keeping result visible for ${Math.round(
            RESULT_VIEW_MS / 1000
          )} seconds.`
        )
      }

      // Clear local state from the previous match.
      hasStaked = false
      hasCommitted = false
      hasRevealed = false
      clearMove()

      const canRestartNow =
        nextMatchRequested ||
        (AUTO_RESTART && Date.now() - finishedObservedAt >= RESULT_VIEW_MS)

      if (!canRestartNow) {
        console.log('[bot] waiting before starting next match')
        return
      }
    } else {
      finishedObservedAt = null
      await syncStateFromChain()
    }

    // Handle expired commit/reveal windows.
    if (
      (phase === 'commit' || phase === 'reveal') &&
      Date.now() >= nextTimeoutAttemptAt
    ) {
      const deadline =
        phase === 'commit'
          ? Number(await contract.commitWindowEnd())
          : Number(await contract.revealWindowEnd())

      if (deadline > 0 && chainNow > deadline) {
        try {
          console.log(
            `[bot] ${phase} window expired, calling claimTimeout`
          )

          const tx = await contract.claimTimeout()
          await tx.wait()

          console.log(`[bot] claimTimeout successful in ${phase} phase`)
        } catch (err: any) {
          console.error(
            `[bot] claimTimeout failed in ${phase} phase:`,
            err?.shortMessage || err?.message || err
          )

          nextTimeoutAttemptAt = Date.now() + 15_000
        }

        return
      }
    }

    const canStakeAfterFinished =
      phase === 'finished' &&
      (nextMatchRequested ||
        (AUTO_RESTART &&
          finishedObservedAt !== null &&
          Date.now() - finishedObservedAt >= RESULT_VIEW_MS))

    if (
      (phase === 'idle' || (phase === 'finished' && canStakeAfterFinished)) &&
      !hasStaked &&
      !stakingInFlight &&
      Date.now() >= nextStakeAttemptAt
    ) {
      stakingInFlight = true

      try {
        const botAddress = await botWallet.getAddress()
        const me = await readPlayerState(botAddress)

        if (phase === 'idle' && me?.hasStaked) {
          hasStaked = true
          nextMatchRequested = false
          return
        }

        console.log('[bot] attempting to stake...')
        await stakeToGame()

        hasStaked = true
        nextMatchRequested = false

        console.log('[bot] successfully staked!')
      } catch (err: any) {
        console.error('[bot] stake failed:', err?.shortMessage || err?.message || err)

        nextStakeAttemptAt = Date.now() + 15_000
      } finally {
        stakingInFlight = false
      }

      return
    }

    if (phase === 'commit' && !hasCommitted) {
      const move = decideMove()
      const hash = hashCommit(move.secret, move.guess, move.salt)

      console.log('[bot] committing...')

      const tx = await contract.commit(hash)
      await tx.wait()

      hasCommitted = true

      console.log('[bot] successfully committed!')

      return
    }

    if (phase === 'reveal' && !hasRevealed) {
      const move = getCurrentMove()

      if (!move) {
        console.warn('[bot] no stored move to reveal, skipping')
        return
      }

      console.log('[bot] revealing...')

      const tx = await contract.reveal(move.secret, move.guess, move.salt)
      await tx.wait()

      hasRevealed = true

      console.log('[bot] successfully revealed!')

      return
    }
  } catch (err: any) {
    console.error('[bot] tick error:', err?.shortMessage || err?.message || err)
  }
}

export function startWatching(requestNextMatch = false) {
  if (requestNextMatch) {
    nextMatchRequested = true
    console.log('[bot] next match requested via API')
  }

  if (watching) {
    console.log('[bot] watcher already running')
    return
  }

  watching = true

  console.log('[bot] watcher started, ticking immediately...')

  void tick()

  interval = setInterval(() => {
    void tick()
  }, CONFIG.pollIntervalMs)
}

export function stopWatching() {
  if (interval) clearInterval(interval)

  interval = null
  watching = false

  console.log('[bot] watcher stopped')
}

export function isWatching() {
  return watching
}