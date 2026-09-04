import { useState } from 'react'
import { useWallet } from '@/hooks/useWallet'
import { useGameState } from '@/hooks/useGameState'
import { useOutguessDuel } from '@/hooks/useOutguessDuel'
import Header from '@/components/layout/Header'
import GameContainer from '@/components/layout/GameContainer'
import ConnectButton from '@/components/wallet/ConnectButton'
import StakePanel from '@/components/game/StakePanel'
import CommitForm from '@/components/game/CommitForm'
import RevealForm from '@/components/game/RevealForm'
import GameTimer from '@/components/game/GameTimer'
import PotDisplay from '@/components/game/PotDisplay'
import WinnerBanner from '@/components/game/WinnerBanner'

export default function App() {
  const { account, signer, isConnected, connect, disconnect } = useWallet()
  const { state, refresh } = useGameState(signer)
  const { stake, commit, reveal, claimTimeout } = useOutguessDuel(signer)
  const [lastHash, setLastHash] = useState<string | null>(null)

  const isPlayer = account === state.player1 || account === state.player2
  const isStaked = isPlayer && state.phase !== 'idle'

  const handleStake = async (amount: string) => {
    await stake(amount)
    refresh()
  }

  const handleCommit = async (secret: number, guess: number, salt: string) => {
    const hash = await commit(secret, guess, salt)
    setLastHash(hash)
    refresh()
  }

  const handleReveal = async (secret: number, guess: number, salt: string) => {
    await reveal(secret, guess, salt)
    refresh()
  }

  const handleClaimTimeout = async () => {
    await claimTimeout()
    refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <Header />
      <GameContainer>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <ConnectButton account={account} onConnect={connect} onDisconnect={disconnect} />
        </div>

        {!isConnected ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
            <p>Connect your wallet to play Outguess Duel.</p>
          </div>
        ) : (
          <>
            <PotDisplay amount={state.pot} />

            {state.phase === 'finished' && state.winner && (
              <WinnerBanner
                result={state.winner === account ? 'win' : state.winner === '0x0000000000000000000000000000000000000000' ? 'tie' : 'lose'}
              />
            )}

            {state.phase === 'idle' && (
              <StakePanel onStake={handleStake} pot={state.pot} isStaked={isStaked} />
            )}

            {state.phase === 'commit' && (
              <>
                <GameTimer endTime={state.commitDeadline} label="Commit Window" />
                <CommitForm onCommit={handleCommit} hashPreview={lastHash} />
              </>
            )}

            {state.phase === 'reveal' && (
              <>
                <GameTimer endTime={state.revealDeadline} label="Reveal Window" />
                <RevealForm onReveal={handleReveal} />
                <button
                  onClick={handleClaimTimeout}
                  style={{ width: '100%', padding: '0.75rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '0.5rem' }}
                >
                  Claim Timeout (Opponent Ghosted)
                </button>
              </>
            )}

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#111', borderRadius: '4px', fontSize: '0.75rem', color: '#666' }}>
              <p style={{ margin: '0 0 0.25rem' }}><strong>Phase:</strong> {state.phase}</p>
              <p style={{ margin: '0 0 0.25rem' }}><strong>You:</strong> {account?.slice(0, 10)}...</p>
              <p style={{ margin: '0' }}><strong>P1:</strong> {state.player1?.slice(0, 10) ?? 'None'}... | <strong>P2:</strong> {state.player2?.slice(0, 10) ?? 'None'}...</p>
            </div>
          </>
        )}
      </GameContainer>
    </div>
  )
}
