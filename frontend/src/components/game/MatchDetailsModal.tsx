import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Contract, JsonRpcSigner } from 'ethers'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import {
  absDiff,
  deriveCachedYouOpponent,
  normalizePlayerDetails,
  shortAddress,
  toBigInt,
  type CachedMatchDetails,
  type PlayerDetails,
} from '@/utils/matchDetails'

interface Props {
  open: boolean
  onClose: () => void
  signer: JsonRpcSigner | null
  account: string | null
  player1: string | null
  player2: string | null
  winner: string | null
  pot: string
  phase: string
  cachedMatch?: CachedMatchDetails | null
  preferCached?: boolean
}

interface DisplayDetails {
  you: PlayerDetails | null
  opponent: PlayerDetails | null
  winner: string | null
  pot: string
  source: 'live' | 'cached'
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

const cardStyle: CSSProperties = {
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '1rem',
  background: '#111',
}

const labelStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  color: '#888',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '1px',
}

const breakAllStyle: CSSProperties = {
  wordBreak: 'break-all',
}

export default function MatchDetailsModal({
  open,
  onClose,
  signer,
  account,
  player1,
  player2,
  winner,
  pot,
  phase,
  cachedMatch,
  preferCached = false,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<DisplayDetails | null>(null)

  const loadDetails = useCallback(async () => {
    if (!open) return

    setLoading(true)
    setError(null)

    const applyCached = () => {
      if (!cachedMatch) return

      const derived = deriveCachedYouOpponent(account, cachedMatch)

      setDetails({
        you: derived.you,
        opponent: derived.opponent,
        winner: cachedMatch.winner,
        pot: cachedMatch.pot ?? pot,
        source: 'cached',
      })
    }

    try {
      if (
        preferCached &&
        cachedMatch &&
        (cachedMatch.player1Details || cachedMatch.player2Details)
      ) {
        applyCached()
        return
      }

      if (!signer) {
        if (cachedMatch) {
          applyCached()
        } else {
          setError('Wallet not connected.')
        }
        return
      }

      const contract = new Contract(CONFIG.contractAddress, ABI, signer)

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

      if (!liveValid && cachedMatch) {
        applyCached()
        return
      }

      setDetails({
        you: liveYou,
        opponent: liveOpponent,
        winner,
        pot,
        source: 'live',
      })
    } catch (err: any) {
      if (cachedMatch) {
        applyCached()
      } else {
        setError(err?.message || 'Failed to load match details.')
      }
    } finally {
      setLoading(false)
    }
  }, [
    open,
    signer,
    account,
    player1,
    player2,
    winner,
    pot,
    cachedMatch,
    preferCached,
  ])

  useEffect(() => {
    if (open) {
      void loadDetails()
    }
  }, [open, loadDetails])

  if (!open) return null

  const you = details?.you ?? null
  const opponent = details?.opponent ?? null
  const displayWinner = details?.winner ?? null
  const displayPot = details?.pot ?? pot
  const source = details?.source ?? 'live'

  const lowerAccount = account?.toLowerCase() ?? null

  const youIsPlayer = Boolean(
    lowerAccount &&
      ((player1?.toLowerCase() === lowerAccount) ||
        (player2?.toLowerCase() === lowerAccount))
  )

  const youSecret = toBigInt(you?.secret)
  const youGuess = toBigInt(you?.guess)
  const opponentSecret = toBigInt(opponent?.secret)
  const opponentGuess = toBigInt(opponent?.guess)

  const canCalculate = Boolean(you?.hasRevealed && opponent?.hasRevealed)

  const yourDistance = canCalculate
    ? absDiff(youGuess, opponentSecret)
    : null

  const opponentDistance = canCalculate
    ? absDiff(opponentGuess, youSecret)
    : null

  const winnerIsYou = Boolean(
    displayWinner &&
      account &&
      displayWinner.toLowerCase() === account.toLowerCase()
  )

  const winnerIsOpponent = Boolean(
    displayWinner &&
      opponent &&
      displayWinner.toLowerCase() === opponent.address.toLowerCase()
  )

  const winnerLabel = displayWinner
    ? winnerIsYou
      ? `You (${shortAddress(displayWinner)})`
      : winnerIsOpponent
        ? `Opponent (${shortAddress(displayWinner)})`
        : shortAddress(displayWinner)
    : 'No winner / tie'

  const renderPlayerCard = (
    label: string,
    player: PlayerDetails | null
  ) => {
    return (
      <div style={cardStyle}>
        <p style={labelStyle}>{label}</p>

        {!player ? (
          <p style={{ margin: 0, color: '#888' }}>No address available.</p>
        ) : (
          <>
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Address:</strong>
              <br />
              <span style={breakAllStyle}>{player.address}</span>
            </p>

            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Is Player:</strong> {player.isPlayer ? 'Yes' : 'No'}
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

  return (
    <div style={overlayStyle} onClick={onClose}>
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
            onClick={onClose}
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
            Close
          </button>
        </div>

        {loading && <p style={{ color: '#888' }}>Loading match details...</p>}

        {error && (
          <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>
        )}

        {!loading && !error && (
          <>
            {source === 'cached' && (
              <p
                style={{
                  color: '#eab308',
                  fontSize: '0.8rem',
                  marginTop: 0,
                  marginBottom: '1rem',
                }}
              >
                Showing saved result from session storage. The live contract
                state may have already reset.
              </p>
            )}

            <div style={{ ...cardStyle, marginBottom: '0.75rem' }}>
              <p style={labelStyle}>Contract</p>

              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>Contract Address:</strong>
                <br />
                <span style={breakAllStyle}>{CONFIG.contractAddress}</span>
              </p>

              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>Phase:</strong> {phase}
              </p>

              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>Live Contract Pot:</strong> {displayPot} ETH
              </p>

              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>Winner:</strong> {winnerLabel}
              </p>

              <p style={{ margin: 0 }}>
                <strong>Match Player 1:</strong>{' '}
                {player1 ? shortAddress(player1) : 'None'}
              </p>

              <p style={{ margin: 0 }}>
                <strong>Match Player 2:</strong>{' '}
                {player2 ? shortAddress(player2) : 'None'}
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
              {renderPlayerCard(
                youIsPlayer ? 'You' : 'Connected Wallet',
                you
              )}

              {renderPlayerCard(
                youIsPlayer ? 'Opponent' : 'Match Player',
                opponent
              )}
            </div>

            <div style={cardStyle}>
              <p style={labelStyle}>Contract Result Calculation</p>

              {canCalculate ? (
                <>
                  <p style={{ margin: '0 0 0.5rem' }}>
                    Your distance:{' '}
                    <code>
                      |{you?.guess} - {opponent?.secret}| ={' '}
                      {yourDistance?.toString()}
                    </code>
                  </p>

                  <p style={{ margin: '0 0 0.5rem' }}>
                    Opponent distance:{' '}
                    <code>
                      |{opponent?.guess} - {you?.secret}| ={' '}
                      {opponentDistance?.toString()}
                    </code>
                  </p>

                  <p style={{ margin: '0 0 0.5rem', color: '#888' }}>
                    Smaller distance wins. If distances are equal, the pot is
                    split.
                  </p>

                  <p style={{ margin: 0 }}>
                    <strong>Result:</strong>{' '}
                    {displayWinner
                      ? winnerIsYou
                        ? 'You had the smaller distance.'
                        : winnerIsOpponent
                          ? 'Opponent had the smaller distance.'
                          : 'Winner determined by contract.'
                      : 'Distance tie — pot split.'}
                  </p>
                </>
              ) : (
                <p style={{ margin: 0, color: '#888' }}>
                  Full secret/guess values are readable after both players
                  reveal and before the contract resets. If a new match has
                  started, old values may have been cleared.
                </p>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={() => void loadDetails()}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Refresh Details
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}