interface Props {
  result: 'win' | 'lose' | 'tie' | 'timeout' | null
  payout?: string
  winner?: string | null
  account?: string | null
  isPrevious?: boolean
  onDismiss?: () => void
  onShowDetails?: () => void
}

export default function WinnerBanner({
  result,
  payout,
  winner,
  account,
  isPrevious,
  onDismiss,
  onShowDetails,
}: Props) {
  if (!result) return null

  const styles: Record<string, { bg: string; text: string }> = {
    win: { bg: '#064e3b', text: '#22c55e' },
    lose: { bg: '#450a0a', text: '#ef4444' },
    tie: { bg: '#422006', text: '#eab308' },
    timeout: { bg: '#171717', text: '#888' },
  }

  const messages = {
    win: 'You Win!',
    lose: 'You Lose',
    tie: 'Distance Tie — Pot Split',
    timeout: 'Opponent Timed Out',
  }

  const winnerIsYou = Boolean(
    winner && account && winner.toLowerCase() === account.toLowerCase()
  )

  const shortWinner = winner
    ? `${winner.slice(0, 6)}...${winner.slice(-4)}`
    : null

  return (
    <div
      style={{
        padding: '1.5rem',
        background: styles[result].bg,
        border: `1px solid ${styles[result].text}`,
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
          color: styles[result].text,
        }}
      >
        {messages[result]}
      </h2>

      {result !== 'tie' && shortWinner && (
        <p
          style={{
            margin: '0 0 0.5rem',
            color: '#fff',
            fontSize: '0.875rem',
          }}
        >
          Winner: {shortWinner} {winnerIsYou ? '(you)' : ''}
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

      {payout && (
        <p style={{ margin: 0, color: '#fff' }}>
          Payout: {payout} ETH
        </p>
      )}

      {(onShowDetails || onDismiss) && (
        <div
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {onShowDetails && (
            <button
              onClick={onShowDetails}
              style={{
                padding: '0.4rem 0.8rem',
                background: '#111',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Match Details
            </button>
          )}

          {onDismiss && (
            <button
              onClick={onDismiss}
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
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  )
}