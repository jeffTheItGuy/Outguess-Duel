import { useState } from 'react'

const MAX_GAME_VALUE = 999

interface Props {
  onCommit: (secret: number, guess: number, salt: string) => void
  hashPreview: string | null
}

export default function CommitForm({ onCommit, hashPreview }: Props) {
  const [secret, setSecret] = useState('')
  const [guess, setGuess] = useState('')
  const [salt, setSalt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleGenerateSalt = () => {
    const randomSalt =
      '0x' +
      Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    setSalt(randomSalt)
  }

  const handleSubmit = () => {
    setError(null)

    const secretNum = Number(secret)
    const guessNum = Number(guess)

    if (!Number.isInteger(secretNum) || secretNum < 0 || secretNum > MAX_GAME_VALUE) {
      setError(`Secret must be a whole number between 0 and ${MAX_GAME_VALUE}`)
      return
    }

    if (!Number.isInteger(guessNum) || guessNum < 0 || guessNum > MAX_GAME_VALUE) {
      setError(`Guess must be a whole number between 0 and ${MAX_GAME_VALUE}`)
      return
    }

    if (!salt) {
      setError('You must generate a salt before committing')
      return
    }

    onCommit(secretNum, guessNum, salt)
  }

  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    marginBottom: '1rem',
    background: '#111',
    border: '1px solid #333',
    color: '#fff',
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
      <h3 style={{ marginTop: 0 }}>Commit Phase</h3>
      <p style={{ color: '#888', fontSize: '0.875rem' }}>
        Pick a number between 0 and {MAX_GAME_VALUE}, then guess your
        opponent&apos;s number.
      </p>

      <label
        style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
        }}
      >
        Your Secret Number (0–{MAX_GAME_VALUE})
      </label>
      <input
        type="number"
        min={0}
        max={MAX_GAME_VALUE}
        step={1}
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        style={inputStyle}
      />

      <label
        style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
        }}
      >
        Your Guess of Opponent&apos;s Number (0–{MAX_GAME_VALUE})
      </label>
      <input
        type="number"
        min={0}
        max={MAX_GAME_VALUE}
        step={1}
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          value={salt}
          readOnly
          style={{
            flex: 1,
            padding: '0.5rem',
            background: '#111',
            border: '1px solid #333',
            color: '#888',
            borderRadius: '4px',
            fontSize: '0.75rem',
          }}
        />
        <button
          onClick={handleGenerateSalt}
          style={{
            padding: '0.5rem 1rem',
            background: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Generate Salt
        </button>
      </div>

      {hashPreview && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: '#0a0a0a',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: '#888',
            wordBreak: 'break-all',
          }}
        >
          <strong>Hash Preview:</strong>
          <br />
          {hashPreview}
        </div>
      )}

      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '1rem' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!salt || secret === '' || guess === ''}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          opacity: !salt || secret === '' || guess === '' ? 0.5 : 1,
        }}
      >
        Submit Commit
      </button>
    </div>
  )
}