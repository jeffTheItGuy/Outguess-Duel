interface Props {
  onPlayNow?: () => void
}

export default function Header({ onPlayNow }: Props) {
  return (
    <header
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.75rem',
        padding: '2rem',
        textAlign: 'center',
        background: 'radial-gradient(circle at top, #111 0%, #0a0a0a 55%)',
      }}
    >
      <img
        src="/logo.png"
        alt="Outguess Duel logo"
        style={{
          width: 'min(360px, 75vw)',
          height: 'auto',
          objectFit: 'contain',
        }}
      />

      <div style={{ maxWidth: '640px' }}>


        <p
          style={{
            margin: 0,
            color: '#9ca3af',
            fontSize: '1rem',
            lineHeight: 1.6,
          }}
        >
          Stake ETH, commit your secret number and guess, then reveal and see
          if you outguess your opponent.
        </p>
      </div>

      {onPlayNow && (
        <button
          type="button"
          onClick={onPlayNow}
          style={{
            padding: '0.9rem 2.4rem',
            background: '#2563eb',
            color: '#fff',
            border: '1px solid #2563eb',
            borderRadius: '999px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 700,
          }}
        >
          Play Now
        </button>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          color: '#666',
          fontSize: '1.75rem',
        }}
      >
        ↓
      </div>
    </header>
  )
}