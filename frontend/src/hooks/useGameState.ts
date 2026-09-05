import { useState, useEffect, useCallback } from 'react'
import { Contract, JsonRpcSigner, formatEther } from 'ethers'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import { GameState } from '@/types/game'

async function readStakeAmount(contract: Contract): Promise<bigint> {
  const anyContract = contract as any

  // If your contract actually has requiredStake(), you can add it to the ABI.
  // Otherwise, fall back to stakeAmount().
  if (typeof anyContract.requiredStake === 'function') {
    try {
      const value = BigInt(await anyContract.requiredStake())
      if (value > 0n) return value
    } catch {}
  }

  if (typeof anyContract.stakeAmount === 'function') {
    try {
      const value = BigInt(await anyContract.stakeAmount())
      if (value > 0n) return value
    } catch {}
  }

  return 0n
}

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
        commitEnd,
        revealEnd,
        p1,
        p2,
        winnerRaw,
        playerData,
      ] = await Promise.all([
        contract.gamePhase(),
        contract.pot(),
        contract.commitWindowEnd(),
        contract.revealWindowEnd(),
        contract.player1(),
        contract.player2(),
        contract.winner(),
        contract.players(address),
      ])

      const stakeAmountRaw = await readStakeAmount(contract)

      const phaseMap = ['idle', 'commit', 'reveal', 'finished'] as const

      setState({
        phase: phaseMap[Number(phaseRaw)] ?? 'idle',
        pot: formatEther(potRaw),
        requiredStake: formatEther(stakeAmountRaw),
        requiredStakeIsSet: stakeAmountRaw > 0n,
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