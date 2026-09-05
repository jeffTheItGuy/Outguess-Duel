export type GamePhase = 'idle' | 'commit' | 'reveal' | 'finished'

export interface Player {
  addr: string
  committed: boolean
  revealed: boolean
  secret: number
  guess: number
}

export interface GameState {
  phase: GamePhase
  pot: string
  commitDeadline: number | null
  revealDeadline: number | null
  player1: string | null
  player2: string | null
  winner: string | null
  myCommitHash: string | null
  requiredStake: string | null
  requiredStakeIsSet: boolean
  myHasStaked: boolean
}