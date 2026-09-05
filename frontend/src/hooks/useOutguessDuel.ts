import { useCallback } from 'react'
import { Contract, JsonRpcSigner, parseEther } from 'ethers'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import ERC20_ABI from '@/abi/ERC20.json'
import { hashCommit } from '@/utils/hashing'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function readStakeAmount(contract: Contract): Promise<bigint | null> {
  const anyContract = contract as any

  if (typeof anyContract.requiredStake === 'function') {
    try {
      const value = BigInt(await anyContract.requiredStake())
      if (value > 0n) return value
    } catch {}
  }

  if (typeof anyContract.stakeAmount === 'function') {
    try {
      const value = BigInt(await anyContract.stakeAmount())
      if (value > 0n) return value
    } catch {}
  }

  return null
}

export function useOutguessDuel(signer: JsonRpcSigner | null) {
  const getContract = useCallback(() => {
    if (!signer) throw new Error('Wallet not connected')
    return new Contract(CONFIG.contractAddress, ABI, signer)
  }, [signer])

  const stake = useCallback(
    async (amount: string) => {
      const contract = getContract()

      let tokenAddress: string | null = null

      try {
        tokenAddress = await contract.token()
      } catch {}

      const isErc20 = Boolean(
        tokenAddress && tokenAddress !== ZERO_ADDRESS
      )

      const onchainStakeAmount = await readStakeAmount(contract)

      const fallbackAmount =
        amount && Number(amount) > 0 ? parseEther(amount) : 0n

      if (isErc20 && tokenAddress) {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer)

        const stakeAmount = onchainStakeAmount ?? fallbackAmount

        if (stakeAmount <= 0n) {
          throw new Error('Enter a stake amount')
        }

        const approveTx = await tokenContract.approve(
          CONFIG.contractAddress,
          stakeAmount
        )

        await approveTx.wait()

        const tx = await contract.stake()
        await tx.wait()

        return
      }

      // Native ETH flow.
      // Prefer the contract's required stake amount if it exists.
      const value = onchainStakeAmount ?? fallbackAmount

      if (value <= 0n) {
        throw new Error('Enter a stake amount')
      }

      const tx = await contract.stake({ value })
      await tx.wait()
    },
    [getContract, signer]
  )

  const commit = useCallback(
    async (secret: number, guess: number, salt: string) => {
      const contract = getContract()
      const hash = hashCommit(secret, guess, salt)

      const tx = await contract.commit(hash)
      await tx.wait()

      return hash
    },
    [getContract]
  )

  const reveal = useCallback(
    async (secret: number, guess: number, salt: string) => {
      const contract = getContract()

      const tx = await contract.reveal(secret, guess, salt)
      await tx.wait()
    },
    [getContract]
  )

  const claimTimeout = useCallback(async () => {
    const contract = getContract()

    const tx = await contract.claimTimeout()
    await tx.wait()
  }, [getContract])

  return { stake, commit, reveal, claimTimeout }
}