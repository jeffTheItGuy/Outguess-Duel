interface Props {
  amount: string
  tokenSymbol?: string
}

export default function PotDisplay({ amount, tokenSymbol = 'ETH' }: Props) {
  return (
    <div style={{ padding: '1.5rem', border: '1px solid #333', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>
      <p style={{ margin: '0 0 0.25rem', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Pot</p>
      <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>{amount} <span style={{ fontSize: '1rem', color: '#888' }}>{tokenSymbol}</span></p>
    </div>
  )
}
