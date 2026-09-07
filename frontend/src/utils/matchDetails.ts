import { Contract, JsonRpcSigner } from 'ethers'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'

export interface PlayerDetails {
  address: string
  isPlayer: boolean
  hasStaked: boolean
  hasCommitted: boolean
  hasRevealed: boolean
  commitHash: string
  secret: string
  guess: string
}

export interface CachedMatchDetails {
  winner: string | null
  timestamp: number
  pot?: string
  player1?: string | null
  player2?: string | null
  player1Details?: PlayerDetails | null
  player2Details?: PlayerDetails | null
}

export function normalizePlayerDetails(
  address: string,
  raw: any
): PlayerDetails {
  return {
    address,
    isPlayer: Boolean(raw?.isPlayer),
    hasStaked: Boolean(raw?.hasStaked),
    hasCommitted: Boolean(raw?.hasCommitted),
    hasRevealed: Boolean(raw?.hasRevealed),
    commitHash: String(raw?.commitHash ?? ''),
    secret: String(raw?.secret ?? 0),
    guess: String(raw?.guess ?? 0),
  }
}

export async function fetchPlayerDetails(
  signer: JsonRpcSigner,
  address: string | null
): Promise<PlayerDetails | null> {
  if (!address) return null

  const contract = new Contract(CONFIG.contractAddress, ABI, signer)
  const raw = await contract.players(address)

  return normalizePlayerDetails(address, raw)
}

export function toBigInt(value: string | null | undefined): bigint {
  try {
    return BigInt(value || '0')
  } catch {
    return 0n
  }
}

export function absDiff(a: bigint, b: bigint): bigint {
  return a >= b ? a - b : b - a
}

export function shortAddress(address?: string | null): string {
  if (!address) return 'None'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function deriveCachedYouOpponent(
  account: string | null,
  cached: CachedMatchDetails
): {
  you: PlayerDetails | null
  opponent: PlayerDetails | null
} {
  const lowerAccount = account?.toLowerCase() ?? null

  const player1Details = cached.player1Details ?? null
  const player2Details = cached.player2Details ?? null

  if (
    lowerAccount &&
    cached.player1 &&
    cached.player1.toLowerCase() === lowerAccount
  ) {
    return {
      you: player1Details,
      opponent: player2Details,
    }
  }

  if (
    lowerAccount &&
    cached.player2 &&
    cached.player2.toLowerCase() === lowerAccount
  ) {
    return {
      you: player2Details,
      opponent: player1Details,
    }
  }

  return {
    you: player1Details,
    opponent: player2Details,
  }
}