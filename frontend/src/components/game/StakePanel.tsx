import { useEffect, useState } from 'react'

interface Props {
  onStake: (amount: string) => void
  pot: string
  isStaked: boolean
  requiredStake: string | null
  requiredStakeIsSet: boolean
}

export default function StakePanel({
  onStake,
  pot,
  isStaked,
  requiredStake,
  requiredStakeIsSet,
}: Props) {
  const [amount, setAmount] = useState(requiredStake ?? '0.01')

  useEffect(() => {
    if (requiredStakeIsSet && requiredStake) {
      setAmount(requiredStake)
    }
  }, [requiredStakeIsSet, requiredStake])

  const disabled = !amount || Number(amount) <= 0

  return (
    <div
      style={{
        padding: '1.5rem',
        border: '1px solid #333',
        borderRadius: '8px',
        marginBottom: '1rem',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Stake</h3>

      <p style={{ color: '#888', fontSize: '0.875rem' }}>
        Current pot: {pot} ETH
      </p>

      {requiredStakeIsSet && (
        <p
          style={{
            color: '#888',
            fontSize: '0.875rem',
            margin: '0 0 0.75rem',
          }}
        >
          Required stake: {requiredStake} ETH
        </p>
      )}

      {!isStaked ? (
        <>
          <label
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              color: '#888',
            }}
          >
            Deposit Amount
          </label>

          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.01"
            style={{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '0.75rem',
              background: '#111',
              border: '1px solid #333',
              color: '#fff',
              borderRadius: '4px',
            }}
          />

          <button
            onClick={() => onStake(amount)}
            disabled={disabled}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Deposit Stake ({amount || '0'} ETH)
          </button>
        </>
      ) : (
        <p style={{ color: '#22c55e' }}>
          You are staked. Waiting for opponent...
        </p>
      )}
    </div>
  )
}