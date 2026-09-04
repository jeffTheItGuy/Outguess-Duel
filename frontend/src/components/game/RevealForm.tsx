import { useState } from 'react'

interface Props {
  onReveal: (secret: number, guess: number, salt: string) => void
}

export default function RevealForm({ onReveal }: Props) {
  const [secret, setSecret] = useState('')
  const [guess, setGuess] = useState('')
  const [salt, setSalt] = useState('')

  const handleSubmit = () => {
    onReveal(Number(secret), Number(guess), salt)
  }

  return (
    <div style={{ padding: '1.5rem', border: '1px solid #333', borderRadius: '8px', marginBottom: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>Reveal Phase</h3>
      <p style={{ color: '#888', fontSize: '0.875rem' }}>Reveal your original numbers to verify your commit.</p>

      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Your Secret Number</label>
      <input type="number" value={secret} onChange={(e) => setSecret(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />

      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Your Guess</label>
      <input type="number" value={guess} onChange={(e) => setGuess(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }} />

      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Salt</label>
      <input type="text" value={salt} onChange={(e) => setSalt(e.target.value)} style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px', fontSize: '0.75rem' }} />

      <button onClick={handleSubmit} disabled={!salt || secret === '' || guess === ''} style={{ width: '100%', padding: '0.75rem', background: '#22c55e', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (!salt || secret === '' || guess === '') ? 0.5 : 1 }}>
        Reveal
      </button>
    </div>
  )
}
