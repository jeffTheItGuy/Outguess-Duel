import { useState, useEffect, useCallback } from 'react'
import { BrowserProvider, JsonRpcSigner } from 'ethers'
import { CONFIG } from '@/config'

export function useWallet() {
  const [account, setAccount] = useState<string | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('MetaMask not detected')
      return
    }

    const provider = new BrowserProvider(window.ethereum)
    const network = await provider.getNetwork()

    if (Number(network.chainId) !== CONFIG.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + CONFIG.chainId.toString(16) }],
        })
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + CONFIG.chainId.toString(16),
              chainName: CONFIG.chainName,
              rpcUrls: [CONFIG.rpcUrl],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            }],
          })
        }
      }
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const newProvider = new BrowserProvider(window.ethereum)
    const newSigner = await newProvider.getSigner()

    setAccount(accounts[0])
    setSigner(newSigner)
    setIsConnected(true)
  }, [])

  const disconnect = useCallback(() => {
    setAccount(null)
    setSigner(null)
    setIsConnected(false)
  }, [])

  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect()
      else setAccount(accounts[0])
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
    }
  }, [disconnect])

  return { account, signer, isConnected, connect, disconnect }
}
