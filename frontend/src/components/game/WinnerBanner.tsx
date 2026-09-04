interface Props {
  result: 'win' | 'lose' | 'tie' | 'timeout' | null
  payout?: string
}

export default function WinnerBanner({ result, payout }: Props) {
  if (!result) return null

  const styles: Record<string, { bg: string; text: string }> = {
    win: { bg: '#064e3b', text: '#22c55e' },
    lose: { bg: '#450a0a', text: '#ef4444' },
    tie: { bg: '#422006', text: '#eab308' },
    timeout: { bg: '#171717', text: '#888' },
  }

  const messages = {
    win: 'You Win!',
    lose: 'You Lose',
    tie: 'Exact Tie — Pot Split',
    timeout: 'Opponent Timed Out',
  }

  return (
    <div style={{ padding: '1.5rem', background: styles[result].bg, border: `1px solid ${styles[result].text}`, borderRadius: '8px', marginBottom: '1rem', textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 0.5rem', color: styles[result].text }}>{messages[result]}</h2>
      {payout && <p style={{ margin: 0, color: '#fff' }}>Payout: {payout} ETH</p>}
    </div>
  )
}
