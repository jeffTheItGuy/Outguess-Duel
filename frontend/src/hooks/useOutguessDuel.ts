// frontend/src/hooks/useOutguessDuel.ts

import { useCallback } from 'react'
import { Contract, JsonRpcSigner, parseEther } from 'ethers'
import { CONFIG } from '@/config'
import ABI from '@/abi/OutguessDuel.json'
import ERC20_ABI from '@/abi/ERC20.json'
import { hashCommit } from '@/utils/hashing'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function getRevertReason(err: any): string {
  if (err?.reason) return err.reason
  if (err?.shortMessage) return err.shortMessage
  if (err?.error?.reason) return err.error.reason
  if (err?.error?.message) return err.error.message
  if (err?.info?.error?.message) return err.info.error.message
  if (err?.message) return err.message
  return 'Transaction failed'
}

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

      try {
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
        const value = onchainStakeAmount ?? fallbackAmount

        if (value <= 0n) {
          throw new Error('Enter a stake amount')
        }

        const tx = await contract.stake({ value })
        await tx.wait()
      } catch (err: any) {
        // If the user rejected the MetaMask popup, don't treat it as a contract error
        if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
          throw new Error('Transaction rejected in MetaMask')
        }

        const reason = getRevertReason(err)
        console.error('[stake] failed:', reason)
        console.error('[stake] full error:', err)
        throw new Error(reason)
      }
    },
    [getContract, signer]
  )

  const commit = useCallback(
    async (secret: number, guess: number, salt: string) => {
      const contract = getContract()

      try {
        const hash = hashCommit(secret, guess, salt)
        const tx = await contract.commit(hash)
        await tx.wait()
        return hash
      } catch (err: any) {
        if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
          throw new Error('Transaction rejected in MetaMask')
        }

        const reason = getRevertReason(err)
        console.error('[commit] failed:', reason)
        console.error('[commit] full error:', err)
        throw new Error(reason)
      }
    },
    [getContract]
  )

  const reveal = useCallback(
    async (secret: number, guess: number, salt: string) => {
      const contract = getContract()

      try {
        const tx = await contract.reveal(secret, guess, salt)
        await tx.wait()
      } catch (err: any) {
        if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
          throw new Error('Transaction rejected in MetaMask')
        }

        const reason = getRevertReason(err)
        console.error('[reveal] failed:', reason)
        console.error('[reveal] full error:', err)
        throw new Error(reason)
      }
    },
    [getContract]
  )

  const claimTimeout = useCallback(async () => {
    const contract = getContract()

    try {
      const tx = await contract.claimTimeout()
      await tx.wait()
    } catch (err: any) {
      if (err?.code === 'ACTION_REJECTED' || err?.code === 4001) {
        throw new Error('Transaction rejected in MetaMask')
      }

      const reason = getRevertReason(err)
      console.error('[claimTimeout] failed:', reason)
      console.error('[claimTimeout] full error:', err)
      throw new Error(reason)
    }
  }, [getContract])

  return { stake, commit, reveal, claimTimeout }
}