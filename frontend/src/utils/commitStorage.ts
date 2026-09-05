import { CONFIG } from '@/config'

export interface StoredCommit {
  secret: number
  guess: number
  salt: string
  hash: string
  timestamp: number
}

function storageKey(account: string | null): string {
  return `outguess-duel:commit:${CONFIG.contractAddress}:${account?.toLowerCase()}`
}

export function saveCommit(
  account: string | null,
  commit: Omit<StoredCommit, 'timestamp'>
) {
  if (!account) return

  localStorage.setItem(
    storageKey(account),
    JSON.stringify({
      ...commit,
      timestamp: Date.now(),
    })
  )
}

export function loadCommit(account: string | null): StoredCommit | null {
  if (!account) return null

  try {
    const raw = localStorage.getItem(storageKey(account))
    if (!raw) return null

    return JSON.parse(raw) as StoredCommit
  } catch {
    return null
  }
}

export function clearCommit(account: string | null) {
  if (!account) return
  localStorage.removeItem(storageKey(account))
}