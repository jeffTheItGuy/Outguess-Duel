import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const CONFIG = {
  rpcUrl: process.env.RPC_URL ?? 'http://127.0.0.1:8545',
  contractAddress: required('CONTRACT_ADDRESS'),
  botPrivateKey: required('BOT_PRIVATE_KEY'),
  port: Number(process.env.PORT ?? 4000),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 3000),
  stakeAmountEth: process.env.STAKE_AMOUNT_ETH ?? '0.01',
  secretRange: { min: 0, max: 999 },
  guessRange: { min: 0, max: 999 },
}