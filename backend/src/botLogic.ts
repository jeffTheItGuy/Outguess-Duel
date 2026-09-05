import { randomBytes, randomInt } from 'crypto'
import { CONFIG } from './config'

export interface BotMove {
  secret: number
  guess: number
  salt: string
}

// In-memory store for the single active game.
// For concurrent games, replace this with a Map keyed by game/contract id.
let currentMove: BotMove | null = null

function generateSalt(): string {
  return '0x' + randomBytes(32).toString('hex')
}

export function decideMove(): BotMove {
  currentMove = {
    secret: randomInt(CONFIG.secretRange.min, CONFIG.secretRange.max + 1),
    guess: randomInt(CONFIG.guessRange.min, CONFIG.guessRange.max + 1),
    salt: generateSalt(),
  }
  return currentMove
}

export function getCurrentMove(): BotMove | null {
  return currentMove
}

export function clearMove(): void {
  currentMove = null
}