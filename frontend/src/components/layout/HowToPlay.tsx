export default function HowToPlay() {
  return (
    <div style={{ marginBottom: '2rem', color: '#777', fontSize: '0.85rem', lineHeight: 1.8 }}>
      <p style={{ margin: '0 0 0.5rem', color: '#aaa' }}>How it works</p>
      <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
        <li>Both players stake the same ETH amount.</li>
        <li>Commit a hash of your secret number + guess + salt.</li>
        <li>Reveal your original values. Contract verifies against your hash.</li>
        <li>|your guess − their secret| is compared both ways. Smaller wins the pot.</li>
        <li>Miss a window and the other player can claim the win or refund.</li>
      </ol>
    </div>
  )
}