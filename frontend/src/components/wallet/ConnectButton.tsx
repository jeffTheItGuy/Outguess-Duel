interface Props {
  account: string | null
  onConnect: () => void
  onDisconnect: () => void
}

export default function ConnectButton({ account, onConnect, onDisconnect }: Props) {
  return (
    <button
      onClick={account ? onDisconnect : onConnect}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: '6px',
        border: '1px solid #444',
        background: account ? '#1a1a1a' : '#2563eb',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '0.875rem',
      }}
    >
      {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connect Wallet'}
    </button>
  )
}