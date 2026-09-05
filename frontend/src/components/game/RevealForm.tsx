import { useEffect, useState } from 'react'

interface Props {
  onReveal: (secret: number, guess: number, salt: string) => void
  initialSecret?: string
  initialGuess?: string
  initialSalt?: string
  canEdit?: boolean
}

export default function RevealForm({
  onReveal,
  initialSecret = '',
  initialGuess = '',
  initialSalt = '',
  canEdit = true,
}: Props) {
  const [secret, setSecret] = useState(initialSecret)
  const [guess, setGuess] = useState(initialGuess)
  const [salt, setSalt] = useState(initialSalt)

  useEffect(() => {
    setSecret(initialSecret)
    setGuess(initialGuess)
    setSalt(initialSalt)
  }, [initialSecret, initialGuess, initialSalt])

  const disabled = !salt || secret === '' || guess === ''

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    marginBottom: '1rem',
    background: '#111',
    border: '1px solid #333',
    color: canEdit ? '#fff' : '#888',
    borderRadius: '4px',
  }

  return (
    <div
      style={{
        padding: '1.5rem',
        border: '1px solid #333',
        borderRadius: '8px',
        marginBottom: '1rem',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Reveal Phase</h3>

      <p style={{ color: '#888', fontSize: '0.875rem' }}>
        Reveal your original numbers to verify your commit.
      </p>

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
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        readOnly={!canEdit}
        style={inputStyle}
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
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        readOnly={!canEdit}
        style={inputStyle}
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
        value={salt}
        onChange={(e) => setSalt(e.target.value)}
        readOnly={!canEdit}
        style={{
          ...inputStyle,
          fontSize: '0.75rem',
        }}
      />

      <button
        onClick={() => onReveal(Number(secret), Number(guess), salt)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: '#22c55e',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {canEdit ? 'Reveal' : 'Confirm Saved Reveal'}
      </button>
    </div>
  )
}