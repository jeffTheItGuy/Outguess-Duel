import { Contract, parseEther } from 'ethers'
import { CONFIG } from './config'
import { botContract, botWallet, provider, ERC20_ABI } from './chainClient'
import { hashCommit } from './hashing'
import { decideMove, getCurrentMove, clearMove } from './botLogic'

const PHASES = ['idle', 'commit', 'reveal', 'finished'] as const
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const contract: any = botContract

let watching = false
let hasStaked = false
let hasCommitted = false
let hasRevealed = false
let stakingInFlight = false
let nextStakeAttemptAt = 0

let interval: ReturnType<typeof setInterval> | null = null

async function readBigInt(call: () => Promise<any>): Promise<bigint | null> {
  try {
    const value = await call()
    return BigInt(value)
  } catch {
    return null
  }
}

async function getRequiredStake(): Promise<bigint> {
  // Prefer requiredStake(), because your frontend is already calling that.
  const requiredStake = await readBigInt(() => contract.requiredStake())
  if (requiredStake !== null && requiredStake > 0n) {
    return requiredStake
  }

  // Fallback to stakeAmount() for older contract versions.
  const stakeAmount = await readBigInt(() => contract.stakeAmount())
  if (stakeAmount !== null && stakeAmount > 0n) {
    return stakeAmount
  }

  // Final fallback from env/config.
  const fallback = parseEther(CONFIG.stakeAmountEth)
  if (fallback > 0n) {
    return fallback
  }

  throw new Error('Could not determine stake amount from requiredStake(), stakeAmount(), or STAKE_AMOUNT_ETH')
}

async function getTokenAddress(): Promise<string | null> {
  try {
    const token = await contract.token()
    if (token && token !== ZERO_ADDRESS) {
      return token
    }
    return null
  } catch {
    return null
  }
}

async function readPlayerState(address: string): Promise<any | null> {
  try {
    return await contract.players(address)
  } catch {
    return null
  }
}

async function syncStateFromChain(): Promise<void> {
  const botAddress = await botWallet.getAddress()
  const me = await readPlayerState(botAddress)

  if (!me) return

  if (me.hasStaked) {
    hasStaked = true
  }

  if (me.hasCommitted) {
    hasCommitted = true
  }

  if (me.hasRevealed) {
    hasRevealed = true
  }
}

async function stakeNative(amount: bigint): Promise<void> {
  const botAddress = await botWallet.getAddress()
  const balance = await provider.getBalance(botAddress)

  if (balance < amount) {
    throw new Error(
      `Bot native balance too low. Required: ${amount.toString()}, available: ${balance.toString()}`
    )
  }

  const tx = await contract.stake({ value: amount })
  await tx.wait()
}

async function stakeErc20(tokenAddress: string, amount: bigint): Promise<void> {
  const token: any = new Contract(tokenAddress, ERC20_ABI, botWallet)

  const gameAddress = await contract.getAddress()
  const botAddress = await botWallet.getAddress()

  const balance = await readBigInt(() => token.balanceOf(botAddress))
  if (balance === null) {
    throw new Error('Could not read ERC20 balanceOf')
  }

  if (balance < amount) {
    throw new Error(
      `Bot ERC20 balance too low. Required: ${amount.toString()}, available: ${balance.toString()}`
    )
  }

  const allowance = await readBigInt(() => token.allowance(botAddress, gameAddress))
  if (allowance === null) {
    throw new Error('Could not read ERC20 allowance')
  }

  if (allowance < amount) {
    console.log('[bot] approving ERC20 token for game contract...')
    const approveTx = await token.approve(gameAddress, amount)
    await approveTx.wait()
  }

  const tx = await contract.stake()
  await tx.wait()
}

async function stakeToGame(): Promise<void> {
  const amount = await getRequiredStake()
  console.log('[bot] required stake:', amount.toString())

  const tokenAddress = await getTokenAddress()

  if (tokenAddress) {
    console.log('[bot] using ERC20 stake flow:', tokenAddress)
    await stakeErc20(tokenAddress, amount)
  } else {
    console.log('[bot] using native ETH stake flow')
    await stakeNative(amount)
  }
}

async function tick() {
  await syncStateFromChain()

  const phaseRaw = await contract.gamePhase()
  const phase = PHASES[Number(phaseRaw)] ?? 'idle'

  if (
    phase === 'idle' &&
    !hasStaked &&
    !stakingInFlight &&
    Date.now() >= nextStakeAttemptAt
  ) {
    stakingInFlight = true

    try {
      const botAddress = await botWallet.getAddress()
      const me = await readPlayerState(botAddress)

      if (me?.hasStaked) {
        hasStaked = true
        return
      }

      console.log('[bot] staking...')
      await stakeToGame()

      hasStaked = true
    } catch (err) {
      // Prevent spamming the same failing stake call every 3 seconds.
      nextStakeAttemptAt = Date.now() + 15_000
      throw err
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
    return
  }

  if (phase === 'finished') {
    console.log('[bot] game finished, resetting')

    hasStaked = false
    hasCommitted = false
    hasRevealed = false

    clearMove()
    stopWatching()
  }
}

export function startWatching() {
  if (watching) return

  watching = true

  interval = setInterval(() => {
    tick().catch((err) => console.error('[bot] tick error:', err))
  }, CONFIG.pollIntervalMs)

  console.log('[bot] watcher started')
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