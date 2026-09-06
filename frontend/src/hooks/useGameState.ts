import { useState, useEffect, useCallback } from 'react'
import { Contract, JsonRpcSigner, formatEther } from 'ethers'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import { GameState } from '@/types/game'

export function useGameState(signer: JsonRpcSigner | null) {
  const [state, setState] = useState<GameState>({
    phase: 'idle',
    pot: '0',
    requiredStake: null,
    requiredStakeIsSet: false,
    commitDeadline: null,
    revealDeadline: null,
    player1: null,
    player2: null,
    winner: null,
    myCommitHash: null,
    myHasStaked: false,
  })

  const fetchState = useCallback(async () => {
    if (!signer) return

    const contract = new Contract(CONFIG.contractAddress, ABI, signer)
    const address = await signer.getAddress()

    try {
      const [
        phaseRaw,
        potRaw,
        requiredStakeRaw,
        commitEnd,
        revealEnd,
        p1,
        p2,
        winnerRaw,
        playerData,
      ] = await Promise.all([
        contract.gamePhase(),
        contract.pot(),
        contract.requiredStake(),
        contract.commitWindowEnd(),
        contract.revealWindowEnd(),
        contract.player1(),
        contract.player2(),
        contract.winner(),
        contract.players(address),
      ])

      const phaseMap = ['idle', 'commit', 'reveal', 'finished'] as const
      const requiredStakeBig = BigInt(requiredStakeRaw)

      setState({
        phase: phaseMap[Number(phaseRaw)] ?? 'idle',
        pot: formatEther(potRaw),
        requiredStake: formatEther(requiredStakeBig),
        requiredStakeIsSet: requiredStakeBig > 0n,
        commitDeadline: Number(commitEnd) > 0 ? Number(commitEnd) : null,
        revealDeadline: Number(revealEnd) > 0 ? Number(revealEnd) : null,
        player1:
          p1 === '0x0000000000000000000000000000000000000000' ? null : p1,
        player2:
          p2 === '0x0000000000000000000000000000000000000000' ? null : p2,
        winner:
          winnerRaw === '0x0000000000000000000000000000000000000000'
            ? null
            : winnerRaw,
        myCommitHash: playerData.commitHash,
        myHasStaked: playerData.hasStaked,
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