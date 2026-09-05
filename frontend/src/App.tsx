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

export default function App() {
  const { account, signer, isConnected, connect, disconnect } = useWallet()
  const { state, refresh } = useGameState(signer)
  const { stake, commit, reveal, claimTimeout } = useOutguessDuel(signer)
  const { startBot, starting } = useBot()

  const [lastHash, setLastHash] = useState<string | null>(null)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))

  const [storedCommit, setStoredCommit] = useState<StoredCommit | null>(null)

  const [revealSecret, setRevealSecret] = useState('')
  const [revealGuess, setRevealGuess] = useState('')
  const [revealSalt, setRevealSalt] = useState('')

  const [myHasRevealed, setMyHasRevealed] = useState(false)

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

  // Directly poll whether the connected wallet has revealed.
  // This avoids needing to modify useGameState/types just for the timeout button.
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

  const isPlayer = account === state.player1 || account === state.player2
  const isStaked = isPlayer && state.phase !== 'idle'

  const canClaimTimeout =
    state.revealDeadline !== null &&
    now >= state.revealDeadline &&
    myHasRevealed &&
    isPlayer

  const revealSecretNumber = Number(revealSecret)
  const revealGuessNumber = Number(revealGuess)

  const revealDisabled =
    revealSecret.trim() === '' ||
    revealGuess.trim() === '' ||
    revealSalt.trim() === '' ||
    Number.isNaN(revealSecretNumber) ||
    Number.isNaN(revealGuessNumber)

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
    await claimTimeout()
    refresh()
  }

  const handleStartBot = async () => {
    await startBot()
    setTimeout(() => refresh(), 1500)
  }

  const claimButtonLabel = !myHasRevealed
    ? 'You Must Reveal Before Claiming Timeout'
    : state.revealDeadline !== null && now < state.revealDeadline
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

            {state.phase === 'idle' && (
              <button
                onClick={handleStartBot}
                disabled={starting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '1rem',
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
            )}

            <PotDisplay amount={state.pot} />

            {state.phase === 'finished' && (
              <WinnerBanner
                result={
                  state.winner
                    ? state.winner === account
                      ? 'win'
                      : 'lose'
                    : 'tie'
                }
              />
            )}

            {state.phase === 'idle' && (
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

                <CommitForm
                  onCommit={handleCommit}
                  hashPreview={lastHash}
                />
              </>
            )}

            {state.phase === 'reveal' && (
              <>
                <GameTimer
                  endTime={state.revealDeadline}
                  label="Reveal Window"
                />

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

                <button
                  onClick={handleClaimTimeout}
                  disabled={!canClaimTimeout}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: canClaimTimeout ? '#dc2626' : '#444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: canClaimTimeout ? 'pointer' : 'not-allowed',
                    marginTop: '0.5rem',
                    opacity: canClaimTimeout ? 1 : 0.5,
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
                <strong>Has Revealed:</strong> {myHasRevealed ? 'Yes' : 'No'}
              </p>

              <p style={{ margin: '0 0 0.25rem' }}>
                <strong>Saved Commit:</strong> {storedCommit ? 'Yes' : 'No'}
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