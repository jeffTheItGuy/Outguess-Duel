import { DEPLOYED_CONTRACT_ADDRESS } from '@/generated/contract'

export const CONFIG = {
  chainId: 31337,
  chainName: 'Hardhat Local',
  rpcUrl: 'http://127.0.0.1:8545',
  contractAddress: DEPLOYED_CONTRACT_ADDRESS,
  commitWindowSeconds: 300,
  revealWindowSeconds: 300,
}