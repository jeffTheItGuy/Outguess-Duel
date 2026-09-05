import { parseEther } from 'ethers'

// Default Hardhat Account #0.
// This account is funded with 10,000 ETH on a fresh local Hardhat node.
const HARDHAT_RICH_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

export async function requestLocalFunds(
  recipient: string,
  amountInEth: string
): Promise<string | null> {
  const valueHex = `0x${parseEther(amountInEth).toString(16)}`

  const res = await fetch('/hardhat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'eth_sendTransaction',
      params: [
        {
          from: HARDHAT_RICH_ACCOUNT,
          to: recipient,
          value: valueHex,
        },
      ],
    }),
  })

  const data = await res.json()

  if (data.error) {
    throw new Error(data.error.message || 'Faucet request failed')
  }

  // Give the local Hardhat node a moment to mine the transaction.
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return data.result ?? null
}