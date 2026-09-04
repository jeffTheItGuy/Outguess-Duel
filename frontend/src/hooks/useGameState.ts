import { useState, useEffect, useCallback } from 'react'
import { Contract, JsonRpcSigner, formatEther } from 'ethers'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import { GameState } from '@/types/game'

export function useGameState(signer: JsonRpcSigner | null) {
  const [state, setState] = useState<GameState>({
    phase: 'idle',
    pot: '0',
    commitDeadline: null,
    revealDeadline: null,
    player1: null,
    player2: null,
    winner: null,
    myCommitHash: null,
  })

  const fetchState = useCallback(async () => {
    if (!signer) return

    const contract = new Contract(CONFIG.contractAddress, ABI, signer)
    const address = await signer.getAddress()

    try {
      const [phaseRaw, potRaw, commitEnd, revealEnd, p1, p2, winnerRaw, playerData] = await Promise.all([
        contract.gamePhase(),
        contract.pot(),
        contract.commitWindowEnd(),
        contract.revealWindowEnd(),
        contract.player1(),
        contract.player2(),
        contract.winner(),
        contract.players(address),
      ])

      const phaseMap = ['idle', 'commit', 'reveal', 'finished'] as const

      setState({
        phase: phaseMap[Number(phaseRaw)] ?? 'idle',
        pot: formatEther(potRaw),
        commitDeadline: Number(commitEnd) > 0 ? Number(commitEnd) : null,
        revealDeadline: Number(revealEnd) > 0 ? Number(revealEnd) : null,
        player1: p1 === '0x0000000000000000000000000000000000000000' ? null : p1,
        player2: p2 === '0x0000000000000000000000000000000000000000' ? null : p2,
        winner: winnerRaw === '0x0000000000000000000000000000000000000000' ? null : winnerRaw,
        myCommitHash: playerData.commitHash,
      })
    } catch (e) {
      console.error('Failed to fetch game state:', e)
    }
  }, [signer])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 3000)
    return () => clearInterval(interval)
  }, [fetchState])

  return { state, refresh: fetchState }
}
