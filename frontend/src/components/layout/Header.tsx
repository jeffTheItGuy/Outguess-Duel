export default function Header() {
  return (
    <header style={{ padding: '1rem 2rem', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h1 style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '-0.5px' }}>Outguess Duel</h1>
      <span style={{ color: '#888', fontSize: '0.875rem' }}>Local Hardhat</span>
    </header>
  )
}
