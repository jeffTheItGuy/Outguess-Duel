import { useState, useCallback } from 'react'

interface BotStatus {
  watching: boolean
  address: string | null
}

export function useBot() {
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [starting, setStarting] = useState(false)

  const startBot = useCallback(async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/bot/start-match', { method: 'POST' })
      const data = await res.json()
      console.log('[frontend] bot started:', data)
    } catch (err) {
      console.error('[frontend] failed to start bot:', err)
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

  return { botStatus, starting, startBot, getBotStatus }
}