import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Contract, type JsonRpcSigner } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { useGameState } from '@/hooks/useGameState'
import { useOutguessDuel } from '@/hooks/useOutguessDuel'
import { useBot } from '@/hooks/useBot'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import Header from '@/components/layout/Header'
import GameContainer from '@/components/layout/GameContainer'
import HowToPlay from '@/components/layout/HowToPlay'
import ConnectPrompt from '@/components/wallet/ConnectPrompt'
import FaucetPanel from '@/components/game/FaucetPanel'
import StakePanel from '@/components/game/StakePanel'
import CommitForm from '@/components/game/CommitForm'
import GameTimer from '@/components/game/GameTimer'
import PotDisplay from '@/components/game/PotDisplay'

interface StoredCommit {
  secret: number
  guess: number
  salt: string
  hash: string
  timestamp: number
}

interface PlayerDetails {
  address: string
  isPlayer: boolean
  hasStaked: boolean
  hasCommitted: boolean
  hasRevealed: boolean
  commitHash: string
  secret: string
  guess: string
}

interface LastFinishedResult {
  winner: string | null
  timestamp: number
  pot?: string
  player1?: string | null
  player2?: string | null
  player1Details?: PlayerDetails | null
  player2Details?: PlayerDetails | null
}

interface MatchDetailsDisplay {
  you: PlayerDetails | null
  opponent: PlayerDetails | null
  winner: string | null
  pot: string
  source: 'live' | 'cached'
}

type StartMode = 'menu' | 'human' | 'bot'
type DetailsSource = 'current' | 'previous' | null

function commitStorageKey(account: string | null): string {
  return `outguess-duel:commit:${CONFIG.contractAddress}:${account?.toLowerCase()}`
}

function saveCommit(
  account: string | null,
  commit: Omit<StoredCommit, 'timestamp'>
) {
  if (!account) return

  localStorage.setItem(
    commitStorageKey(account),
    JSON.stringify({
      ...commit,
      timestamp: Date.now(),
    })
  )
}

function loadCommit(account: string | null): StoredCommit | null {
  if (!account) return null

  try {
    const raw = localStorage.getItem(commitStorageKey(account))
    if (!raw) return null
    return JSON.parse(raw) as StoredCommit
  } catch {
    return null
  }
}

function clearCommit(account: string | null) {
  if (!account) return
  localStorage.removeItem(commitStorageKey(account))
}

function getResultForAccount(
  winner: string | null,
  account: string | null
): 'win' | 'lose' | 'tie' {
  if (!winner) return 'tie'

  if (account && winner.toLowerCase() === account.toLowerCase()) {
    return 'win'
  }

  return 'lose'
}

function normalizePlayerDetails(address: string, raw: any): PlayerDetails {
  return {
    address,
    isPlayer: Boolean(raw?.isPlayer),
    hasStaked: Boolean(raw?.hasStaked),
    hasCommitted: Boolean(raw?.hasCommitted),
    hasRevealed: Boolean(raw?.hasRevealed),
    commitHash: String(raw?.commitHash ?? ''),
    secret: String(raw?.secret ?? 0),
    guess: String(raw?.guess ?? 0),
  }
}

async function fetchPlayerDetails(
  signer: JsonRpcSigner,
  address: string | null
): Promise<PlayerDetails | null> {
  if (!address) return null

  const contract = new Contract(CONFIG.contractAddress, ABI, signer)
  const raw = await contract.players(address)

  return normalizePlayerDetails(address, raw)
}

function toBigInt(value: string | null | undefined): bigint {
  try {
    return BigInt(value || '0')
  } catch {
    return 0n
  }
}

function absDiff(a: bigint, b: bigint): bigint {
  return a >= b ? a - b : b - a
}

function shortAddress(address?: string | null): string {
  if (!address) return 'None'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function deriveCachedYouOpponent(
  account: string | null,
  cached: LastFinishedResult
): {
  you: PlayerDetails | null
  opponent: PlayerDetails | null
} {
  const fallback = (address?: string | null): PlayerDetails | null => {
    if (!address) return null

    return {
      address,
      isPlayer: true,
      hasStaked: true,
      hasCommitted: false,
      hasRevealed: false,
      commitHash: '',
      secret: '0',
      guess: '0',
    }
  }

  const player1Details = cached.player1Details ?? fallback(cached.player1)
  const player2Details = cached.player2Details ?? fallback(cached.player2)

  const lowerAccount = account?.toLowerCase() ?? null

  if (
    lowerAccount &&
    cached.player1 &&
    cached.player1.toLowerCase() === lowerAccount
  ) {
    return {
      you: player1Details,
      opponent: player2Details,
    }
  }

  if (
    lowerAccount &&
    cached.player2 &&
    cached.player2.toLowerCase() === lowerAccount
  ) {
    return {
      you: player2Details,
      opponent: player1Details,
    }
  }

  return {
    you: player1Details,
    opponent: player2Details,
  }
}

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

const RESULT_STORAGE_KEY = `outguess-duel:last-result:${CONFIG.contractAddress}`

const smallButtonStyle: CSSProperties = {
  padding: '0.4rem 0.8rem',
  background: '#111',
  color: '#fff',
  border: '1px solid #444',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.75rem',
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
}

const modalStyle: CSSProperties = {
  width: '100%',
  maxWidth: '720px',
  maxHeight: '85vh',
  overflowY: 'auto',
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '1.5rem',
}

const modalCardStyle: CSSProperties = {
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '1rem',
  background: '#111',
}

const modalLabelStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  color: '#888',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '1px',
}

const breakAllStyle: CSSProperties = {
  wordBreak: 'break-all',
}

const resultBannerStyles: Record <
  'win' | 'lose' | 'tie',
  { bg: string; text: string }
> = {
  win: { bg: '#064e3b', text: '#22c55e' },
  lose: { bg: '#450a0a', text: '#ef4444' },
  tie: { bg: '#422006', text: '#eab308' },
}

const resultBannerMessages: Record<'win' | 'lose' | 'tie', string> = {
  win: 'You Win!',
  lose: 'You Lose',
  tie: 'Distance Tie — Pot Split',
}

export default function App() {
  const { account, signer, isConnected, connect, disconnect } = useWallet()
  const { state, refresh } = useGameState(signer)
  const {
    stake,
    commit,
    reveal,
    claimTimeout,
    unstake,
  } = useOutguessDuel(signer)
  const { startBot, starting, error: botError } = useBot()

  const [lastHash, setLastHash] = useState<string | null>(null)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  const [storedCommit, setStoredCommit] = useState<StoredCommit | null>(null)
  const [revealSecret, setRevealSecret] = useState('')
  const [revealGuess, setRevealGuess] = useState('')
  const [revealSalt, setRevealSalt] = useState('')
  const [myHasRevealed, setMyHasRevealed] = useState(false)
  const [lastFinished, setLastFinished] =
    useState<LastFinishedResult | null>(null)
  const [unstaking, setUnstaking] = useState(false)
  const [unstakeError, setUnstakeError] = useState<string | null>(null)
  const [startMode, setStartMode] = useState<StartMode>('menu')
  const [showDebugInfo, setShowDebugInfo] = useState(false)

  const prevCanStartNewMatch = useRef(false)

  // Ref to track state without causing modal re-fetches on 3s polling updates
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const gameSectionRef = useRef<HTMLDivElement | null>(null)

  const scrollToGame = useCallback(() => {
    gameSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [])

  const [detailsSource, setDetailsSource] = useState<DetailsSource>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [matchDetails, setMatchDetails] =
    useState<MatchDetailsDisplay | null>(null)
  const [botAddress, setBotAddress] = useState<string | null>(null)

  const lastActivePotRef = useRef<string | null>(null)

  const isBotAddress = (address?: string | null) => {
    return Boolean(
      address &&
        botAddress &&
        address.toLowerCase() === botAddress.toLowerCase()
    )
  }

  const addressTags = (address?: string | null) => {
    if (!address) return ''

    const tags: string[] = []

    if (account && address.toLowerCase() === account.toLowerCase()) {
      tags.push('you')
    }

    if (isBotAddress(address)) {
      tags.push('bot')
    }

    return tags.length > 0 ? ` (${tags.join(', ')})` : ''
  }

  const formatPlayerAddress = (address?: string | null) => {
    if (!address) return 'None'
    return `${shortAddress(address)}${addressTags(address)}`
  }

  // Keep current time ticking for timeout logic.
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Close details modal when account changes.
  useEffect(() => {
    setDetailsSource(null)
  }, [account])

  // Close details modal when a new active match starts.
  useEffect(() => {
    if (state.phase === 'commit' || state.phase === 'reveal') {
      setDetailsSource(null)
    }
  }, [state.phase])

  // Fetch bot address from backend so we can label bot opponents.
  useEffect(() => {
    let active = true

    const loadBotAddress = async () => {
      try {
        const res = await fetch('/api/bot/status')
        if (!res.ok) return

        const data = await res.json()
        const address =
          typeof data?.address === 'string' ? data.address : null

        if (active && address) {
          setBotAddress(address)
        }
      } catch {
        // Bot backend not reachable.
      }
    }

    if (!botAddress) {
      void loadBotAddress()
    }

    return () => {
      active = false
    }
  }, [botAddress, detailsSource, starting])

  // Load saved commit whenever account or phase changes.
  useEffect(() => {
    setStoredCommit(loadCommit(account))
  }, [account, state.phase])

  // Prefill reveal fields when entering reveal phase.
  useEffect(() => {
    if (state.phase === 'reveal' && storedCommit) {
      setRevealSecret(String(storedCommit.secret))
      setRevealGuess(String(storedCommit.guess))
      setRevealSalt(storedCommit.salt)
    } else if (state.phase !== 'reveal') {
      setRevealSecret('')
      setRevealGuess('')
      setRevealSalt('')
    }
  }, [state.phase, storedCommit])

  // Clear saved commit once the game is finished.
  useEffect(() => {
    if (state.phase === 'finished') {
      clearCommit(account)
      setStoredCommit(null)
    }
  }, [state.phase, account])

  // Clear unstake errors when phase changes.
  useEffect(() => {
    setUnstakeError(null)
  }, [state.phase])

  // Track the last active pot so finished matches can display the real pot.
  useEffect(() => {
    if (state.phase === 'commit' || state.phase === 'reveal') {
      lastActivePotRef.current = state.pot
    }
  }, [state.phase, state.pot])

  // Load previous finished result from session storage.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESULT_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw)

      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.timestamp === 'number' &&
        (typeof parsed.winner === 'string' || parsed.winner === null)
      ) {
        setLastFinished({
          winner: parsed.winner,
          timestamp: parsed.timestamp,
          pot: typeof parsed.pot === 'string' ? parsed.pot : undefined,
          player1:
            typeof parsed.player1 === 'string' ? parsed.player1 : null,
          player2:
            typeof parsed.player2 === 'string' ? parsed.player2 : null,
          player1Details: parsed.player1Details ?? null,
          player2Details: parsed.player2Details ?? null,
        })
      }
    } catch {
      // Ignore storage errors.
    }
  }, [])

  // Capture the result while the contract is still in the finished phase.
  // Also cache player structs so they can be viewed later.
  useEffect(() => {
    if (state.phase !== 'finished') return

    let active = true

    const save = async () => {
      const next: LastFinishedResult = {
        winner: state.winner,
        timestamp: Date.now(),
        pot: lastActivePotRef.current ?? state.pot,
        player1: state.player1,
        player2: state.player2,
        player1Details: null,
        player2Details: null,
      }

      try {
        if (signer) {
          const [player1Details, player2Details] = await Promise.all([
            fetchPlayerDetails(signer, state.player1),
            fetchPlayerDetails(signer, state.player2),
          ])

          next.player1Details = player1Details
          next.player2Details = player2Details
        }
      } catch (err) {
        console.error('failed to cache finished match details:', err)
      }

      if (!active) return

      setLastFinished(next)

      try {
        sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors.
      }
    }

    void save()

    return () => {
      active = false
    }
  }, [
    state.phase,
    state.winner,
    state.player1,
    state.player2,
    state.pot,
    signer,
  ])

  // Once a new active match begins, clear the previous result.
  useEffect(() => {
    if (state.phase === 'commit' || state.phase === 'reveal') {
      setLastFinished(null)

      try {
        sessionStorage.removeItem(RESULT_STORAGE_KEY)
      } catch {
        // Ignore storage errors.
      }
    }
  }, [state.phase])

  // Directly poll whether the connected wallet has revealed.
  useEffect(() => {
    if (!signer || !account) {
      setMyHasRevealed(false)
      return
    }

    const contract = new Contract(CONFIG.contractAddress, ABI, signer)
    let active = true

    const check = async () => {
      try {
        const playerData = await contract.players(account)

        if (active) {
          setMyHasRevealed(Boolean(playerData.hasRevealed))
        }
      } catch {
        if (active) {
          setMyHasRevealed(false)
        }
      }
    }

    check()

    const interval = setInterval(check, 3000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [signer, account, state.phase])

  // IMPORTANT:
  // MetaMask often returns lowercase addresses, while ethers.js contract reads
  // usually return checksummed addresses. Always compare using lowercase.
  const isPlayer =
    account !== null &&
    (state.player1?.toLowerCase() === account.toLowerCase() ||
      state.player2?.toLowerCase() === account.toLowerCase())

  const myHasCommitted =
    state.myCommitHash !== null && state.myCommitHash !== ZERO_HASH

  // Treat the connected wallet as staked if it has staked in the current match.
  //
  // Important:
  // After the first player stakes, the contract can still be in 'idle'
  // until the second player joins. The UI must show "waiting for opponent".
  //
  // Exclude 'finished' because on-chain player structs are not cleared until
  // the next stake() call, and we need the stake form visible again.
  const isStaked =
    isPlayer &&
    (state.myHasStaked ||
      state.phase === 'commit' ||
      state.phase === 'reveal') &&
    state.phase !== 'finished'

  // Both the Stake panel and the Human/Bot options need to be available
  // whenever a new match can be started.
  const canStartNewMatch =
    state.phase === 'idle' || state.phase === 'finished'

  // You can unstake only if:
  // - match is still idle
  // - you are staked
  //
  // Once the second player joins, phase becomes commit and unstake should
  // no longer be allowed.
  const canUnstake = state.phase === 'idle' && isStaked

  const commitWindowOver =
    state.commitDeadline !== null && now > state.commitDeadline

  const revealWindowOver =
    state.revealDeadline !== null && now > state.revealDeadline

  const canClaimCommitTimeout =
    state.phase === 'commit' && commitWindowOver && isPlayer

  const canClaimRevealTimeout =
    state.phase === 'reveal' &&
    revealWindowOver &&
    myHasRevealed &&
    isPlayer

  const canClaimTimeout =
    canClaimCommitTimeout || canClaimRevealTimeout

  const hasExistingStake = Boolean(state.player1 || state.player2)

  const existingStakeIsBot = Boolean(
    hasExistingStake &&
      (isBotAddress(state.player1) || isBotAddress(state.player2))
  )

  // Reset the Human/Bot selection screen whenever a new match becomes available.
  useEffect(() => {
    if (canStartNewMatch && !prevCanStartNewMatch.current) {
      setStartMode('menu')
    }

    prevCanStartNewMatch.current = canStartNewMatch
  }, [canStartNewMatch])

  // Reset start mode if wallet account changes.
  useEffect(() => {
    setStartMode('menu')
  }, [account])

  const revealSecretNumber = Number(revealSecret)
  const revealGuessNumber = Number(revealGuess)

  const revealDisabled =
    revealSecret.trim() === '' ||
    revealGuess.trim() === '' ||
    revealSalt.trim() === '' ||
    Number.isNaN(revealSecretNumber) ||
    Number.isNaN(revealGuessNumber)

  const currentResult =
    state.phase === 'finished'
      ? getResultForAccount(state.winner, account)
      : null

  const previousResult =
    state.phase === 'idle' && lastFinished
      ? getResultForAccount(lastFinished.winner, account)
      : null

  const dismissLastResult = () => {
    setLastFinished(null)
    setDetailsSource(null)

    try {
      sessionStorage.removeItem(RESULT_STORAGE_KEY)
    } catch {
      // Ignore storage errors.
    }
  }

  const loadMatchDetails = useCallback(async () => {
    if (!detailsSource) return

    setDetailsLoading(true)
    setDetailsError(null)

    const cached = lastFinished
    const currentState = stateRef.current

    // If the phase has moved past 'finished' (e.g., bot auto-restarted),
    // we MUST use the cached snapshot so the modal doesn't show empty data.
    const preferCached =
      detailsSource === 'previous' || currentState.phase !== 'finished'

    const activePot =
      currentState.phase === 'finished'
        ? lastActivePotRef.current ?? currentState.pot
        : currentState.pot

    const applyCached = () => {
      if (!cached) {
        setDetailsError(
          'Match data is no longer available live and was not cached.'
        )
        return
      }

      const derived = deriveCachedYouOpponent(account, cached)

      setMatchDetails({
        you: derived.you,
        opponent: derived.opponent,
        winner: cached.winner,
        pot: cached.pot ?? activePot,
        source: 'cached',
      })
    }

    try {
      if (preferCached) {
        applyCached()
        return
      }

      if (!signer) {
        applyCached()
        return
      }

      const contract = new Contract(CONFIG.contractAddress, ABI, signer)

      const player1 = currentState.player1
      const player2 = currentState.player2

      const lowerAccount = account?.toLowerCase() ?? null
      const lowerPlayer1 = player1?.toLowerCase() ?? null
      const lowerPlayer2 = player2?.toLowerCase() ?? null

      const youIsPlayer = Boolean(
        lowerAccount &&
          (lowerAccount === lowerPlayer1 || lowerAccount === lowerPlayer2)
      )

      const youAddress = account
      let opponentAddress: string | null = null

      if (youIsPlayer && lowerAccount === lowerPlayer1) {
        opponentAddress = player2
      } else if (youIsPlayer && lowerAccount === lowerPlayer2) {
        opponentAddress = player1
      } else {
        opponentAddress = player1 ?? player2
      }

      const [rawYou, rawOpponent] = await Promise.all([
        youAddress ? contract.players(youAddress) : Promise.resolve(null),
        opponentAddress
          ? contract.players(opponentAddress)
          : Promise.resolve(null),
      ])

      const liveYou =
        youAddress && rawYou
          ? normalizePlayerDetails(youAddress, rawYou)
          : null

      const liveOpponent =
        opponentAddress && rawOpponent
          ? normalizePlayerDetails(opponentAddress, rawOpponent)
          : null

      const liveValid = Boolean(
        liveYou?.isPlayer ||
          liveOpponent?.isPlayer ||
          liveYou?.hasStaked ||
          liveOpponent?.hasStaked ||
          liveYou?.hasCommitted ||
          liveOpponent?.hasCommitted ||
          liveYou?.hasRevealed ||
          liveOpponent?.hasRevealed
      )

      if (!liveValid) {
        applyCached()
        return
      }

      setMatchDetails({
        you: liveYou,
        opponent: liveOpponent,
        winner: currentState.winner,
        pot: activePot,
        source: 'live',
      })
    } catch {
      applyCached()
    } finally {
      setDetailsLoading(false)
    }
  }, [
    detailsSource,
    signer,
    account,
    lastFinished,
  ])

  useEffect(() => {
    if (detailsSource) {
      void loadMatchDetails()
    } else {
      setMatchDetails(null)
      setDetailsLoading(false)
      setDetailsError(null)
    }
  }, [detailsSource, loadMatchDetails])

  const handleStake = async (amount: string) => {
    try {
      await stake(amount)
      refresh()
    } catch (err) {
      console.error('stake failed:', err)
    }
  }

  const handleCommit = async (
    secret: number,
    guess: number,
    salt: string
  ) => {
    try {
      const hash = await commit(secret, guess, salt)

      setLastHash(hash)

      saveCommit(account, {
        secret,
        guess,
        salt,
        hash,
      })

      setStoredCommit({
        secret,
        guess,
        salt,
        hash,
        timestamp: Date.now(),
      })

      refresh()
    } catch (err) {
      console.error('commit failed:', err)
    }
  }

  const handleReveal = async () => {
    try {
      await reveal(revealSecretNumber, revealGuessNumber, revealSalt.trim())

      clearCommit(account)
      setStoredCommit(null)
      setMyHasRevealed(true)

      refresh()
    } catch (err) {
      console.error('reveal failed:', err)
    }
  }

  const handleClaimTimeout = async () => {
    try {
      await claimTimeout()
      refresh()
    } catch (err) {
      console.error('claimTimeout failed:', err)
    }
  }

  const handleUnstake = async () => {
    setUnstaking(true)
    setUnstakeError(null)

    try {
      await unstake()
      refresh()
    } catch (err: any) {
      const message = err?.message || 'Unstake failed'
      setUnstakeError(message)
      console.error('unstake failed:', err)
    } finally {
      setUnstaking(false)
    }
  }

  const handleStartBot = async () => {
    try {
      await startBot()
      setTimeout(() => refresh(), 1500)
    } catch {
      // botError from useBot() already holds the message.
    }
  }

  const handleChooseBot = async () => {
    setStartMode('bot')
    await handleStartBot()
  }

  const commitClaimLabel = !commitWindowOver
    ? 'Commit Window Still Active'
    : myHasCommitted
      ? 'Claim Timeout (You Committed)'
      : 'Claim Timeout / Reset Match'

  const claimButtonLabel = !myHasRevealed
    ? revealWindowOver
      ? 'You Missed the Reveal Window'
      : 'You Must Reveal Before Claiming Timeout'
    : !revealWindowOver
      ? 'Timeout Claim Locked Until Reveal Window Ends'
      : 'Claim Timeout (Opponent Ghosted)'

  const revealInputStyle = {
    width: '100%',
    padding: '0.5rem',
    marginBottom: '1rem',
    background: '#111',
    border: '1px solid #333',
    color: storedCommit ? '#888' : '#fff',
    borderRadius: '4px',
  }

  const displayPlayer1 =
    detailsSource === 'previous'
      ? lastFinished?.player1 ?? state.player1
      : state.player1

  const displayPlayer2 =
    detailsSource === 'previous'
      ? lastFinished?.player2 ?? state.player2
      : state.player2

  const modalYou = matchDetails?.you ?? null
  const modalOpponent = matchDetails?.opponent ?? null
  const modalWinner = matchDetails?.winner ?? null
  const modalPot = matchDetails?.pot ?? state.pot
  const modalSource = matchDetails?.source ?? 'live'

  const modalYouSecret = toBigInt(modalYou?.secret)
  const modalYouGuess = toBigInt(modalYou?.guess)
  const modalOpponentSecret = toBigInt(modalOpponent?.secret)
  const modalOpponentGuess = toBigInt(modalOpponent?.guess)

  const modalCanCalculate = Boolean(
    modalYou?.hasRevealed && modalOpponent?.hasRevealed
  )

  const modalYourDistance = modalCanCalculate
    ? absDiff(modalYouGuess, modalOpponentSecret)
    : null

  const modalOpponentDistance = modalCanCalculate
    ? absDiff(modalOpponentGuess, modalYouSecret)
    : null

  const modalWinnerIsYou = Boolean(
    modalWinner &&
      account &&
      modalWinner.toLowerCase() === account.toLowerCase()
  )

  const modalWinnerIsBot = isBotAddress(modalWinner)

  const modalWinnerIsOpponent = Boolean(
    modalWinner &&
      modalOpponent &&
      modalWinner.toLowerCase() === modalOpponent.address.toLowerCase()
  )

  const modalYouIsBot = isBotAddress(modalYou?.address)
  const modalOpponentIsBot = isBotAddress(modalOpponent?.address)

  const modalYouLabel = modalYouIsBot
    ? 'Bot'
    : account &&
        modalYou &&
        modalYou.address.toLowerCase() === account.toLowerCase()
      ? 'You'
      : 'Player'

  const modalOpponentLabel = modalOpponentIsBot
    ? 'Bot'
    : account &&
        modalYou &&
        modalYou.address.toLowerCase() === account.toLowerCase()
      ? 'Opponent'
      : 'Player'

  const modalWinnerLabel = modalWinner
    ? modalWinnerIsYou
      ? `You (${shortAddress(modalWinner)})`
      : modalWinnerIsBot
        ? `Bot (${shortAddress(modalWinner)})`
        : modalWinnerIsOpponent
          ? `Opponent (${shortAddress(modalWinner)})`
          : shortAddress(modalWinner)
    : 'No winner / tie'

  const renderDetailsPlayerCard = (
    label: string,
    player: PlayerDetails | null
  ) => {
    return (
      <div style={modalCardStyle}>
        <p style={modalLabelStyle}>{label}</p>

        {!player ? (
          <p style={{ margin: 0, color: '#888' }}>No address available.</p>
        ) : (
          <>
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Address:</strong>
              <br />
              <span style={breakAllStyle}>{player.address}</span>
              {addressTags(player.address)}
            </p>

            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Player Type:</strong>{' '}
              {isBotAddress(player.address)
                ? 'Bot'
                : account &&
                    player.address.toLowerCase() === account.toLowerCase()
                  ? 'You'
                  : 'Human / External Wallet'}
            </p>

            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Contract Participant:</strong>{' '}
              {player.isPlayer ? 'Yes' : 'No'}
            </p>

            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Staked:</strong> {player.hasStaked ? 'Yes' : 'No'}
            </p>

            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Committed:</strong>{' '}
              {player.hasCommitted ? 'Yes' : 'No'}
            </p>

            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Revealed:</strong> {player.hasRevealed ? 'Yes' : 'No'}
            </p>

            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Commit Hash:</strong>
              <br />
              <span style={breakAllStyle}>
                {player.commitHash || 'None'}
              </span>
            </p>

            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Secret:</strong>{' '}
              {player.hasRevealed ? player.secret : 'Hidden / not readable'}
            </p>

            <p style={{ margin: 0 }}>
              <strong>Guess:</strong>{' '}
              {player.hasRevealed ? player.guess : 'Hidden / not readable'}
            </p>
          </>
        )}
      </div>
    )
  }

  const renderResultBanner = (params: {
    result: 'win' | 'lose' | 'tie'
    winner: string | null
    isPrevious: boolean
    details: 'current' | 'previous'
    onDismiss?: () => void
  }) => {
    const { result, winner, isPrevious, details, onDismiss } = params

    const bannerStyle = resultBannerStyles[result]
    const message = resultBannerMessages[result]

    return (
      <div
        style={{
          padding: '1.5rem',
          background: bannerStyle.bg,
          border: `1px solid ${bannerStyle.text}`,
          borderRadius: '8px',
          marginBottom: '1rem',
          textAlign: 'center',
        }}
      >
        {isPrevious && (
          <p
            style={{
              margin: '0 0 0.5rem',
              color: '#888',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Previous Match Result
          </p>
        )}

        <h2
          style={{
            margin: '0 0 0.5rem',
            color: bannerStyle.text,
          }}
        >
          {message}
        </h2>

        {result !== 'tie' && winner && (
          <p
            style={{
              margin: '0 0 0.5rem',
              color: '#fff',
              fontSize: '0.875rem',
            }}
          >
            Winner: {formatPlayerAddress(winner)}
          </p>
        )}

        {result === 'tie' && (
          <p
            style={{
              margin: '0 0 0.5rem',
              color: '#fff',
              fontSize: '0.875rem',
            }}
          >
            No winner — both players were equally close, so the pot was split.
          </p>
        )}

        <div
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={() => setDetailsSource(details)}
            style={smallButtonStyle}
          >
            Match Details
          </button>

          {onDismiss && (
            <button onClick={onDismiss} style={smallButtonStyle}>
              Dismiss
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <style>
        {`
          html {
            scroll-behavior: smooth;
          }

          body {
            margin: 0;
          }
        `}
      </style>

      <Header onPlayNow={scrollToGame} />

      <div
        ref={gameSectionRef}
        style={{
          scrollMarginTop: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
          padding: '2rem 0',
        }}
      >
        <GameContainer>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: '1rem',
            }}
          >
          </div>

          {!isConnected ? (
            <>
              <ConnectPrompt onConnect={connect} />
              <HowToPlay />
            </>
          ) : (
            <>
              <FaucetPanel account={account} onFunded={refresh} />
              <PotDisplay amount={state.pot} />

              {currentResult &&
                renderResultBanner({
                  result: currentResult,
                  winner: state.winner,
                  isPrevious: false,
                  details: 'current',
                })}

              {previousResult && lastFinished &&
                renderResultBanner({
                  result: previousResult,
                  winner: lastFinished.winner,
                  isPrevious: true,
                  details: 'previous',
                  onDismiss: dismissLastResult,
                })}

              {canStartNewMatch && startMode === 'menu' && !isStaked && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <button
                    onClick={() => setStartMode('human')}
                    style={{
                      padding: '1rem',
                      background: '#111',
                      border: '1px solid #2563eb',
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <strong
                      style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        color: '#60a5fa',
                        fontSize: '1rem',
                      }}
                    >
                      Play vs Human
                    </strong>

                    <span
                      style={{
                        color: '#888',
                        fontSize: '0.8rem',
                        lineHeight: 1.4,
                      }}
                    >
                      {hasExistingStake
                        ? existingStakeIsBot
                          ? 'Join the existing bot stake.'
                          : 'Join the existing stake.'
                        : 'Stake and wait for another wallet to join.'}
                    </span>
                  </button>

                  <button
                    onClick={handleChooseBot}
                    disabled={starting}
                    style={{
                      padding: '1rem',
                      background: '#111',
                      border: '1px solid #7c3aed',
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: starting ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      opacity: starting ? 0.6 : 1,
                    }}
                  >
                    <strong
                      style={{
                        display: 'block',
                        marginBottom: '0.35rem',
                        color: '#a78bfa',
                        fontSize: '1rem',
                      }}
                    >
                      Play vs Bot
                    </strong>

                    <span
                      style={{
                        color: '#888',
                        fontSize: '0.8rem',
                        lineHeight: 1.4,
                      }}
                    >
                      {starting
                        ? 'Starting bot...'
                        : hasExistingStake
                          ? existingStakeIsBot
                            ? 'Bot is already staked. Stake to join it.'
                            : 'Start bot and join the existing stake.'
                          : 'Start the local bot and stake against it.'}
                    </span>
                  </button>
                </div>
              )}

              {canStartNewMatch && (startMode !== 'menu' || isStaked) && (
                <div style={{ marginBottom: '1rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: '#888',
                        fontSize: '0.875rem',
                      }}
                    >
                      {startMode === 'human'
                        ? 'Human match selected.'
                        : startMode === 'bot'
                          ? 'Bot match selected.'
                          : 'You are already staked.'}
                    </p>

                    {!isStaked && (
                      <button
                        onClick={() => setStartMode('menu')}
                        style={{
                          padding: '0.4rem 0.8rem',
                          background: '#222',
                          color: '#fff',
                          border: '1px solid #444',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Back to options
                      </button>
                    )}
                  </div>

                  {startMode === 'bot' && (
                    <p
                      style={{
                        margin: '0 0 0.75rem',
                        color: '#a78bfa',
                        fontSize: '0.8rem',
                      }}
                    >
                      Bot watcher started. Stake to create or join the duel.
                    </p>
                  )}

                  {startMode === 'human' && (
                    <p
                      style={{
                        margin: '0 0 0.75rem',
                        color: '#60a5fa',
                        fontSize: '0.8rem',
                      }}
                    >
                      Stake, then wait for another wallet to stake the same
                      amount.
                    </p>
                  )}

                  <StakePanel
                    onStake={handleStake}
                    pot={state.pot}
                    isStaked={isStaked}
                    requiredStake={
                      state.requiredStakeIsSet ? state.requiredStake : null
                    }
                    requiredStakeIsSet={state.requiredStakeIsSet}
                  />

                  {isStaked && startMode !== 'bot' && (
                    <button
                      onClick={handleChooseBot}
                      disabled={starting}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        marginTop: '0.75rem',
                        background: '#7c3aed',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: starting ? 'not-allowed' : 'pointer',
                        opacity: starting ? 0.5 : 1,
                      }}
                    >
                      {starting ? 'Starting Bot...' : 'Invite Bot to Join'}
                    </button>
                  )}
                </div>
              )}

              {canStartNewMatch && botError && (
                <p
                  style={{
                    color: '#ef4444',
                    fontSize: '0.8rem',
                    marginTop: 0,
                    marginBottom: '1rem',
                  }}
                >
                  Bot failed to start: {botError}
                </p>
              )}

              {canUnstake && (
                <button
                  onClick={handleUnstake}
                  disabled={unstaking}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: unstaking ? 'not-allowed' : 'pointer',
                    opacity: unstaking ? 0.5 : 1,
                  }}
                >
                  {unstaking ? 'Unstaking...' : 'Unstake'}
                </button>
              )}

              {unstakeError && (
                <p
                  style={{
                    color: '#ef4444',
                    fontSize: '0.8rem',
                    marginTop: 0,
                    marginBottom: '1rem',
                  }}
                >
                  Unstake failed: {unstakeError}
                </p>
              )}

              {state.phase === 'commit' && (
                <>
                  <GameTimer
                    endTime={state.commitDeadline}
                    label="Commit Window"
                  />

                  {!commitWindowOver ? (
                    <CommitForm
                      onCommit={handleCommit}
                      hashPreview={lastHash}
                    />
                  ) : (
                    <div
                      style={{
                        padding: '1rem',
                        border: '1px solid #7f1d1d',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                      }}
                    >
                      Commit window expired. Use claim timeout to resolve or
                      reset the duel.
                      <br />
                      <br />
                      If both players committed, this moves the match to Reveal.
                      <br />
                      If only one player committed, that player can claim the
                      win.
                      <br />
                      If neither player committed, the match can be refunded and
                      reset.
                    </div>
                  )}

                  {commitWindowOver && (
                    <button
                      onClick={handleClaimTimeout}
                      disabled={!canClaimCommitTimeout}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: canClaimCommitTimeout ? '#dc2626' : '#444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: canClaimCommitTimeout
                          ? 'pointer'
                          : 'not-allowed',
                        opacity: canClaimCommitTimeout ? 1 : 0.5,
                      }}
                    >
                      {commitClaimLabel}
                    </button>
                  )}
                </>
              )}

              {state.phase === 'reveal' && (
                <>
                  <GameTimer
                    endTime={state.revealDeadline}
                    label="Reveal Window"
                  />

                  {!revealWindowOver ? (
                    <div
                      style={{
                        padding: '1.5rem',
                        border: '1px solid #333',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>Reveal Phase</h3>

                      <p
                        style={{
                          color: '#888',
                          fontSize: '0.875rem',
                        }}
                      >
                        Reveal your original numbers to verify your commit.
                      </p>

                      {storedCommit ? (
                        <p
                          style={{
                            color: '#22c55e',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                          }}
                        >
                          Saved commit found. Confirm reveal below.
                        </p>
                      ) : (
                        <p
                          style={{
                            color: '#ef4444',
                            fontSize: '0.875rem',
                            marginBottom: '1rem',
                          }}
                        >
                          No saved commit found. You must enter the exact secret,
                          guess, and salt used during commit.
                        </p>
                      )}

                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        Your Secret Number
                      </label>
                      <input
                        type="number"
                        value={revealSecret}
                        onChange={(e) => setRevealSecret(e.target.value)}
                        readOnly={Boolean(storedCommit)}
                        style={revealInputStyle}
                      />

                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        Your Guess
                      </label>
                      <input
                        type="number"
                        value={revealGuess}
                        onChange={(e) => setRevealGuess(e.target.value)}
                        readOnly={Boolean(storedCommit)}
                        style={revealInputStyle}
                      />

                      <label
                        style={{
                          display: 'block',
                          marginBottom: '0.5rem',
                          fontSize: '0.875rem',
                        }}
                      >
                        Salt
                      </label>
                      <input
                        type="text"
                        value={revealSalt}
                        onChange={(e) => setRevealSalt(e.target.value)}
                        readOnly={Boolean(storedCommit)}
                        style={{
                          ...revealInputStyle,
                          fontSize: '0.75rem',
                        }}
                      />

                      <button
                        onClick={handleReveal}
                        disabled={revealDisabled}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: '#22c55e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          opacity: revealDisabled ? 0.5 : 1,
                        }}
                      >
                        {storedCommit ? 'Confirm Saved Reveal' : 'Reveal'}
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '1rem',
                        border: '1px solid #7f1d1d',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        color: '#ef4444',
                        fontSize: '0.875rem',
                      }}
                    >
                      Reveal window expired.
                      <br />
                      <br />
                      If both players revealed, claim timeout can finalize the
                      match.
                      <br />
                      If only one player revealed, that player can claim the
                      win.
                      <br />
                      If neither player revealed, the match can be refunded and
                      reset.
                    </div>
                  )}

                  <button
                    onClick={handleClaimTimeout}
                    disabled={!canClaimRevealTimeout}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: canClaimRevealTimeout ? '#dc2626' : '#444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: canClaimRevealTimeout ? 'pointer' : 'not-allowed',
                      marginTop: '0.5rem',
                      opacity: canClaimRevealTimeout ? 1 : 0.5,
                    }}
                  >
                    {claimButtonLabel}
                  </button>
                </>
              )}

              <div style={{ marginTop: '1.5rem' }}>
                <button
                  onClick={() => setShowDebugInfo((prev) => !prev)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#222',
                    color: '#888',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  {showDebugInfo
                    ? 'Hide Technical Details'
                    : 'Show Technical Details'}
                </button>

                {showDebugInfo && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '1rem',
                      background: '#111',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: '#666',
                    }}
                  >
                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Phase:</strong> {state.phase}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>You:</strong> {account?.slice(0, 10)}...
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>P1:</strong> {state.player1?.slice(0, 10) ?? 'None'}
                      ... | <strong>P2:</strong>{' '}
                      {state.player2?.slice(0, 10) ?? 'None'}...
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Bot Address:</strong>{' '}
                      {botAddress ? `${botAddress.slice(0, 10)}...` : 'Unknown'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Start Mode:</strong> {startMode}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Commit Deadline:</strong>{' '}
                      {state.commitDeadline ?? 'None'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Reveal Deadline:</strong>{' '}
                      {state.revealDeadline ?? 'None'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Now:</strong> {now}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Commit Window Over:</strong>{' '}
                      {commitWindowOver ? 'Yes' : 'No'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Reveal Window Over:</strong>{' '}
                      {revealWindowOver ? 'Yes' : 'No'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Has Committed:</strong>{' '}
                      {myHasCommitted ? 'Yes' : 'No'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Has Revealed:</strong> {myHasRevealed ? 'Yes' : 'No'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Saved Commit:</strong> {storedCommit ? 'Yes' : 'No'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Current Winner:</strong>{' '}
                      {state.winner ?? 'None / Tie'}
                    </p>

                    <p style={{ margin: '0 0 0.25rem' }}>
                      <strong>Last Saved Winner:</strong>{' '}
                      {lastFinished ? lastFinished.winner ?? 'Tie' : 'None'}
                    </p>

                    <p style={{ margin: 0 }}>
                      <strong>Can Claim Timeout:</strong>{' '}
                      {canClaimTimeout ? 'Yes' : 'No'}
                    </p>
                  </div>
                )}
              </div>

              {detailsSource !== null && (
                <div style={overlayStyle} onClick={() => setDetailsSource(null)}>
                  <div
                    style={modalStyle}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                      }}
                    >
                      <h3 style={{ margin: 0 }}>Match Details</h3>

                      <button
                        onClick={() => setDetailsSource(null)}
                        style={smallButtonStyle}
                      >
                        Close
                      </button>
                    </div>

                    {detailsLoading && (
                      <p style={{ color: '#888' }}>Loading match details...</p>
                    )}

                    {detailsError && (
                      <p
                        style={{
                          color: '#ef4444',
                          fontSize: '0.875rem',
                        }}
                      >
                        {detailsError}
                      </p>
                    )}

                    {!detailsLoading && !detailsError && matchDetails && (
                      <>
                        {modalSource === 'cached' && (
                          <p
                            style={{
                              color: '#eab308',
                              fontSize: '0.8rem',
                              marginTop: 0,
                              marginBottom: '1rem',
                            }}
                          >
                            Showing saved result from session storage. The live
                            contract state may have already reset.
                          </p>
                        )}

                        <div
                          style={{
                            ...modalCardStyle,
                            marginBottom: '0.75rem',
                          }}
                        >
                          <p style={modalLabelStyle}>Contract</p>

                          <p style={{ margin: '0 0 0.5rem' }}>
                            <strong>Contract Address:</strong>
                            <br />
                            <span style={breakAllStyle}>
                              {CONFIG.contractAddress}
                            </span>
                          </p>

                          <p style={{ margin: '0 0 0.5rem' }}>
                            <strong>Phase:</strong> {state.phase}
                          </p>

                          <p style={{ margin: '0 0 0.5rem' }}>
                            <strong>Match Pot:</strong> {modalPot} ETH
                          </p>

                          <p style={{ margin: '0 0 0.5rem' }}>
                            <strong>Winner:</strong> {modalWinnerLabel}
                          </p>

                          <p style={{ margin: '0 0 0.5rem' }}>
                            <strong>Match Player 1:</strong>{' '}
                            {formatPlayerAddress(displayPlayer1)}
                          </p>

                          <p style={{ margin: 0 }}>
                            <strong>Match Player 2:</strong>{' '}
                            {formatPlayerAddress(displayPlayer2)}
                          </p>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.75rem',
                            marginBottom: '0.75rem',
                          }}
                        >
                          {renderDetailsPlayerCard(modalYouLabel, modalYou)}
                          {renderDetailsPlayerCard(
                            modalOpponentLabel,
                            modalOpponent
                          )}
                        </div>

                        <div style={modalCardStyle}>
                          <p style={modalLabelStyle}>
                            Contract Result Calculation
                          </p>

                          {modalCanCalculate ? (
                            <>
                              <p style={{ margin: '0 0 0.5rem' }}>
                                Your distance:{' '}
                                <code>
                                  |{modalYou?.guess} - {modalOpponent?.secret}|
                                  = {modalYourDistance?.toString()}
                                </code>
                              </p>

                              <p style={{ margin: '0 0 0.5rem' }}>
                                {modalOpponentIsBot ? 'Bot distance' : 'Opponent distance'}:{' '}
                                <code>
                                  |{modalOpponent?.guess} - {modalYou?.secret}|
                                  = {modalOpponentDistance?.toString()}
                                </code>
                              </p>

                              <p
                                style={{
                                  margin: '0 0 0.5rem',
                                  color: '#888',
                                }}
                              >
                                Smaller distance wins. If distances are equal,
                                the pot is split.
                              </p>

                              <p style={{ margin: 0 }}>
                                <strong>Result:</strong>{' '}
                                {modalWinner
                                  ? modalWinnerIsYou
                                    ? 'You had the smaller distance.'
                                    : modalWinnerIsBot
                                      ? 'Bot had the smaller distance.'
                                      : modalWinnerIsOpponent
                                        ? 'Opponent had the smaller distance.'
                                        : 'Winner determined by contract.'
                                  : 'Distance tie — pot split.'}
                              </p>
                            </>
                          ) : (
                            <p style={{ margin: 0, color: '#888' }}>
                              Full secret/guess values are readable after both
                              players reveal and before the contract resets. If
                              a new match has started, old values may have been
                              cleared.
                            </p>
                          )}
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                          <button
                            onClick={() => void loadMatchDetails()}
                            disabled={detailsLoading}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              opacity: detailsLoading ? 0.5 : 1,
                            }}
                          >
                            Refresh Details
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </GameContainer>
      </div>
    </div>
  )
}