import { useState } from 'react'

interface Props {
  onStake: (amount: string) => void
  pot: string
  isStaked: boolean
}

export default function StakePanel({ onStake, pot, isStaked }: Props) {
  const [amount, setAmount] = useState('0.01')

  return (
    <div style={{ padding: '1.5rem', border: '1px solid #333', borderRadius: '8px', marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Stake</h3>
      <p style={{ color: '#888', fontSize: '0.875rem' }}>Current pot: {pot} ETH</p>
      {!isStaked ? (
        <>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
          />
          <button onClick={() => onStake(amount)} style={{ width: '100%', padding: '0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Deposit Stake
          </button>
        </>
      ) : (
        <p style={{ color: '#22c55e' }}>You are staked. Waiting for opponent...</p>
      )}
    </div>
  )
}
