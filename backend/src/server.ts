import express from 'express'
import { CONFIG } from './config'
import { startWatching, isWatching } from './gameWatcher'
import { getBotAddress } from './chainClient'

const app = express()

app.use(express.json())

app.post('/api/bot/start-match', async (_req, res) => {
  console.log('[api] 🟢 POST /api/bot/start-match received')

  // Passing true allows VS Bot to force a rematch if the current game is finished.
  startWatching(true)

  const address = await getBotAddress()

  console.log('[api] Bot status:', {
    watching: isWatching(),
    address,
  })

  res.json({
    status: 'started',
    watching: isWatching(),
    address,
  })
})

app.get('/api/bot/status', async (_req, res) => {
  res.json({
    watching: isWatching(),
    address: await getBotAddress(),
  })
})

app.listen(CONFIG.port, () => {
  console.log(`[bot] server listening on port ${CONFIG.port}`)

  // Resume watching automatically if backend/container restarts.
  startWatching(false)
})