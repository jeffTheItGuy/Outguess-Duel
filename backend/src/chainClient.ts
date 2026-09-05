import { Contract, JsonRpcProvider, Wallet } from 'ethers'
import { CONFIG } from './config'
import ABI from './abi/OutguessDuel.json'
import erc20Abi from './abi/ERC20.json'

export const ERC20_ABI = erc20Abi

export const provider = new JsonRpcProvider(CONFIG.rpcUrl)

export const botWallet = new Wallet(CONFIG.botPrivateKey, provider)

export const botContract = new Contract(
  CONFIG.contractAddress,
  ABI,
  botWallet
)

export async function getBotAddress(): Promise<string> {
  return botWallet.getAddress()
}