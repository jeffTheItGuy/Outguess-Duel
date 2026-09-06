import { useEffect, useState } from 'react'
import { Contract } from 'ethers'
import { useWallet } from '@/hooks/useWallet'
import { useGameState } from '@/hooks/useGameState'
import { useOutguessDuel } from '@/hooks/useOutguessDuel'
import { useBot } from '@/hooks/useBot'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import Header from '@/components/layout/Header'
import GameContainer from '@/components/layout/GameContainer'
import ConnectButton from '@/components/wallet/ConnectButton'
import FaucetPanel from '@/components/game/FaucetPanel'
import StakePanel from '@/components/game/StakePanel'
import CommitForm from '@/components/game/CommitForm'
import GameTimer from '@/components/game/GameTimer'
import PotDisplay from '@/components/game/PotDisplay'
import WinnerBanner from '@/components/game/WinnerBanner'

interface StoredCommit {
  secret: number
  guess: number
  salt: string
  hash: string
  timestamp: number
}

interface LastFinishedResult {
  winner: string | null
  timestamp: number
}

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

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

const RESULT_STORAGE_KEY = `outguess-duel:last-result:${CONFIG.contractAddress}`

export default function App() {
  const { account, signer, isConnected, connect, disconnect } = useWallet()
  const { state, refresh } = useGameState(signer)
  const { stake, commit, reveal, claimTimeout } = useOutguessDuel(signer)
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

  // Keep current time ticking for timeout logic.
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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
        })
      }
    } catch {
      // Ignore storage errors.
    }
  }, [])

  // Capture the result while the contract is still in the finished phase.
  useEffect(() => {
    if (state.phase !== 'finished') return

    const next: LastFinishedResult = {
      winner: state.winner,
      timestamp: Date.now(),
    }

    setLastFinished(next)

    try {
      sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore storage errors.
    }
  }, [state.phase, state.winner])

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

  // Both the Stake panel and the "VS Bot" button need to be available
  // whenever a new match can be started.
  const canStartNewMatch =
    state.phase === 'idle' || state.phase === 'finished'

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

    try {
      sessionStorage.removeItem(RESULT_STORAGE_KEY)
    } catch {
      // Ignore storage errors.
    }
  }

  const handleStake = async (amount: string) => {
    await stake(amount)
    refresh()
  }

  const handleCommit = async (
    secret: number,
    guess: number,
    salt: string
  ) => {
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
  }

  const handleReveal = async () => {
    await reveal(revealSecretNumber, revealGuessNumber, revealSalt.trim())

    clearCommit(account)
    setStoredCommit(null)
    setMyHasRevealed(true)

    refresh()
  }

  const handleClaimTimeout = async () => {
    try {
      await claimTimeout()
      refresh()
    } catch (err) {
      console.error('claimTimeout failed:', err)
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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <Header />

      <GameContainer>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '1rem',
          }}
        >
          <ConnectButton
            account={account}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </div>

        {!isConnected ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#888',
            }}
          >
            <p>Connect your wallet to play Outguess Duel.</p>
          </div>
        ) : (
          <>
            <FaucetPanel account={account} onFunded={refresh} />

            {canStartNewMatch && (
              <>
                <button
                  onClick={handleStartBot}
                  disabled={starting}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    background: '#7c3aed',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    opacity: starting ? 0.5 : 1,
                  }}
                >
                  {starting ? 'Starting Bot...' : 'VS Bot'}
                </button>

                {botError && (
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
              </>
            )}

            <PotDisplay amount={state.pot} />

            {currentResult && (
              <WinnerBanner
                result={currentResult}
                winner={state.winner}
                account={account}
              />
            )}

            {previousResult && lastFinished && (
              <WinnerBanner
                result={previousResult}
                winner={lastFinished.winner}
                account={account}
                isPrevious
                onDismiss={dismissLastResult}
              />
            )}

            {canStartNewMatch && (
              <StakePanel
                onStake={handleStake}
                pot={state.pot}
                isStaked={isStaked}
                requiredStake={
                  state.requiredStakeIsSet ? state.requiredStake : null
                }
                requiredStakeIsSet={state.requiredStakeIsSet}
              />
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
                        No saved commit found. You must enter the exact
                        secret, guess, and salt used during commit.
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

            <div
              style={{
                marginTop: '1.5rem',
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
          </>
        )}
      </GameContainer>
    </div>
  )
}