import { useState } from 'react'

interface Props {
  onCommit: (secret: number, guess: number, salt: string) => void
  hashPreview: string | null
}

export default function CommitForm({ onCommit, hashPreview }: Props) {
  const [secret, setSecret] = useState('')
  const [guess, setGuess] = useState('')
  const [salt, setSalt] = useState('')

  const handleGenerateSalt = () => {
    const randomSalt = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    setSalt(randomSalt)
  }

  const handleSubmit = () => {
    onCommit(Number(secret), Number(guess), salt)
  }

  return (
    <div style={{ padding: '1.5rem', border: '1px solid #333', borderRadius: '8px', marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Commit Phase</h3>
      <p style={{ color: '#888', fontSize: '0.875rem' }}>Pick your secret number and guess your opponent's.</p>

      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Your Secret Number</label>
      <input type="number" value={secret} onChange={(e) => setSecret(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />

      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Your Guess (Opponent's Secret)</label>
      <input type="number" value={guess} onChange={(e) => setGuess(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />

      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Salt</label>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input type="text" value={salt} readOnly style={{ flex: 1, padding: '0.5rem', background: '#111', border: '1px solid #333', color: '#888', borderRadius: '4px', fontSize: '0.75rem' }} />
        <button onClick={handleGenerateSalt} style={{ padding: '0.5rem 1rem', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Generate Salt</button>
      </div>

      {hashPreview && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#0a0a0a', borderRadius: '4px', fontSize: '0.75rem', color: '#888', wordBreak: 'break-all' }}>
          <strong>Hash Preview:</strong><br />{hashPreview}
        </div>
      )}

      <button onClick={handleSubmit} disabled={!salt || secret === '' || guess === ''} style={{ width: '100%', padding: '0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (!salt || secret === '' || guess === '') ? 0.5 : 1 }}>
        Submit Commit
      </button>
    </div>
  )
}
