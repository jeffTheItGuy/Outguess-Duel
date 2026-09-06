import 'dotenv/config'
import fs from 'fs'
import path from 'path'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function readDeployAddress(): string | null {
  let dir = process.cwd()

  // Search upward so this works whether you run from repo root or backend/.
  while (true) {
    const candidate = path.join(dir, '.deploy-address')

    try {
      const value = fs.readFileSync(candidate, 'utf8').trim()
      if (value) return value
    } catch {
      // Keep searching upward.
    }

    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function getContractAddress(): string {
  const envAddress = process.env.CONTRACT_ADDRESS

  if (envAddress && envAddress.toLowerCase() !== 'auto') {
    return envAddress
  }

  const fileAddress = readDeployAddress()

  if (fileAddress) {
    return fileAddress
  }

  throw new Error(
    'Missing contract address. Deploy contracts first or set CONTRACT_ADDRESS.'
  )
}

export const CONFIG = {
  rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545',
  botPrivateKey: required('BOT_PRIVATE_KEY'),
  port: Number(process.env.PORT ?? 4000),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 3000),
  stakeAmountEth: process.env.STAKE_AMOUNT_ETH ?? '0.01',
  secretRange: { min: 0, max: 999 },
  guessRange: { min: 0, max: 999 },
}