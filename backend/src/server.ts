import express from 'express'
import { CONFIG } from './config'
import { startWatching, isWatching } from './gameWatcher'
import { getBotAddress } from './chainClient'

const app = express()

app.use(express.json())

app.post('/api/bot/start-match', async (_req, res) => {
  startWatching()

  res.json({
    status: 'started',
    watching: isWatching(),
    address: await getBotAddress(),
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
})