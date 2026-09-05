import { keccak256, solidityPacked } from 'ethers'

// Must stay identical to frontend/src/utils/hashing.ts so bot commits verify on reveal.
export function hashCommit(secret: number, guess: number, salt: string): string {
  return keccak256(
    solidityPacked(['uint256', 'uint256', 'uint256'], [secret, guess, salt])
  )
}