import { useState } from 'react'
import { requestLocalFunds } from '@/utils/localFaucet'

interface Props {
  account: string | null
  onFunded: () => void
}

export default function FaucetPanel({ account, onFunded }: Props) {
  const [amount, setAmount] = useState('10')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFund = async () => {
    if (!account) return
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      await requestLocalFunds(account, amount)
      setMessage(`✅ Successfully sent ${amount} ETH!`)
      onFunded()
    } catch (err: any) {
      setError(err.message || 'Failed to get funds')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '1rem', border: '1px dashed #444', borderRadius: '8px', marginBottom: '1rem', background: '#111' }}>
      <h4 style={{ margin: '0 0 0.5rem', color: '#f59e0b', fontSize: '0.9rem' }}>🚰 Local Hardhat Faucet</h4>
      <p style={{ margin: '0 0 0.75rem', color: '#888', fontSize: '0.75rem' }}>
        Get test ETH to pay for gas and stakes.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            flex: 1, padding: '0.5rem', background: '#0a0a0a',
            border: '1px solid #333', color: '#fff', borderRadius: '4px'
          }}
        />
        <button
          onClick={handleFund}
          disabled={loading || !amount || Number(amount) <= 0}
          style={{
            padding: '0.5rem 1rem', background: '#f59e0b', color: '#000',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
            opacity: (loading || !amount) ? 0.5 : 1
          }}
        >
          {loading ? 'Sending...' : 'Get ETH'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {['1', '10', '100'].map(val => (
          <button
            key={val}
            onClick={() => setAmount(val)}
            style={{
              flex: 1, padding: '0.25rem', background: '#222', color: '#888',
              border: '1px solid #333', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem'
            }}
          >
            {val} ETH
          </button>
        ))}
      </div>

      {message && <p style={{ margin: 0, color: '#22c55e', fontSize: '0.75rem' }}>{message}</p>}
      {error && <p style={{ margin: 0, color: '#ef4444', fontSize: '0.75rem' }}>{error}</p>}
    </div>
  )
}