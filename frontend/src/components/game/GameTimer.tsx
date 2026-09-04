import { useEffect, useState } from 'react'

interface Props {
  endTime: number | null
  label: string
}

export default function GameTimer({ endTime, label }: Props) {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!endTime) return
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      const left = Math.max(0, endTime - now)
      setRemaining(left)
      if (left === 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  if (!endTime) return null

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  return (
    <div style={{ padding: '1rem', border: '1px solid #333', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>
      <p style={{ margin: '0 0 0.25rem', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '2rem', fontFamily: 'monospace', color: remaining < 30 ? '#ef4444' : '#fff' }}>
        {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
      </p>
    </div>
  )
}
