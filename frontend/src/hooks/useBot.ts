import { useState, useCallback } from 'react'

interface BotStatus {
  watching: boolean
  address: string | null
}

export function useBot() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startBot = useCallback(async () => {
    setStarting(true)
    setError(null)

    try {
      const res = await fetch('/api/bot/start-match', { method: 'POST' })
      const text = await res.text()

      let data: any = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        // Response wasn't JSON — likely a proxy error page (502/404/etc.)
      }

      if (!res.ok) {
        const message =
          data?.error ||
          data?.message ||
          text ||
          `Bot request failed with status ${res.status}`
        throw new Error(message)
      }

      console.log('[frontend] bot started:', data)
      return data
    } catch (err: any) {
      const message = err?.message || 'Failed to start bot'
      console.error('[frontend] failed to start bot:', message)
      setError(message)
      throw err
    } finally {
      setStarting(false)
    }
  }, [])

  const getBotStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/status')
      const data = await res.json()
      setBotStatus(data)
    } catch (err) {
      console.error('[frontend] bot status error:', err)
    }
  }, [])

  return { botStatus, starting, error, startBot, getBotStatus }
}