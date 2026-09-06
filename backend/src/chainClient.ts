import { Contract, JsonRpcProvider, Wallet } from 'ethers'
import { CONFIG, getContractAddress } from './config'
import ABI from './abi/OutguessDuel.json'

export const provider = new JsonRpcProvider(CONFIG.rpcUrl)
export const botWallet = new Wallet(CONFIG.botPrivateKey, provider)

let cachedContract: Contract | null = null
let cachedAddress = ''

export function getBotContract(): Contract {
  const address = getContractAddress()

  if (!cachedContract || cachedAddress !== address) {
    cachedAddress = address
    cachedContract = new Contract(address, ABI, botWallet)
    console.log('[bot] using contract address:', address)
  }

  return cachedContract
}

export async function getBotAddress(): Promise<string> {
  return botWallet.getAddress()
}