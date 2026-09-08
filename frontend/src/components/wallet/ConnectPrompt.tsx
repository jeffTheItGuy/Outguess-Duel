interface Props {
  onConnect: () => void
}

export default function ConnectPrompt({ onConnect }: Props) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <button
        onClick={onConnect}
        style={{
          padding: '0.6rem 1.5rem',
          background: 'transparent',
          color: '#fff',
          border: '1px solid #555',
          borderRadius: '2px',
          cursor: 'pointer',
          fontSize: '0.85rem',
        }}
      >
        Connect Wallet
      </button>
    </div>
  )
}