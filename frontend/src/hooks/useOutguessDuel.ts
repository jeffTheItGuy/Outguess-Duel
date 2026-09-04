import { useCallback } from 'react'
import { Contract, JsonRpcSigner, parseEther } from 'ethers'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import { hashCommit } from '@/utils/hashing'

export function useOutguessDuel(signer: JsonRpcSigner | null) {
  const getContract = useCallback(() => {
    if (!signer) throw new Error('Wallet not connected')
    return new Contract(CONFIG.contractAddress, ABI, signer)
  }, [signer])

  const stake = useCallback(async (amount: string) => {
    const contract = getContract()
    const tx = await contract.stake({ value: parseEther(amount) })
    await tx.wait()
  }, [getContract])

  const commit = useCallback(async (secret: number, guess: number, salt: string) => {
    const contract = getContract()
    const hash = hashCommit(secret, guess, salt)
    const tx = await contract.commit(hash)
    await tx.wait()
    return hash
  }, [getContract])

  const reveal = useCallback(async (secret: number, guess: number, salt: string) => {
    const contract = getContract()
    const tx = await contract.reveal(secret, guess, salt)
    await tx.wait()
  }, [getContract])

  const claimTimeout = useCallback(async () => {
    const contract = getContract()
    const tx = await contract.claimTimeout()
    await tx.wait()
  }, [getContract])

  return { stake, commit, reveal, claimTimeout }
}
