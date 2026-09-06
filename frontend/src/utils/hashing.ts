import { keccak256, solidityPacked } from 'ethers'

const MAX_GAME_VALUE = 999

export function hashCommit(secret: number, guess: number, salt: string): string {
  if (!Number.isInteger(secret) || secret < 0 || secret > MAX_GAME_VALUE) {
    throw new Error(`Secret must be an integer between 0 and ${MAX_GAME_VALUE}`)
  }

  if (!Number.isInteger(guess) || guess < 0 || guess > MAX_GAME_VALUE) {
    throw new Error(`Guess must be an integer between 0 and ${MAX_GAME_VALUE}`)
  }

  return keccak256(
    solidityPacked(
      ['uint256', 'uint256', 'uint256'],
      [secret, guess, salt]
    )
  )
}