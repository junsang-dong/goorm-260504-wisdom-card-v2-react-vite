import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import {
  handleHealth,
  handleSpeech,
  handleWisdomCard,
} from './api-handlers.mjs'

dotenv.config()

const PORT = Number(process.env.API_PORT) || 8787

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', handleHealth)
app.post('/api/speech', (req, res) => {
  void handleSpeech(req, res)
})
app.post('/api/wisdom-card', (req, res) => {
  void handleWisdomCard(req, res)
})

app.listen(PORT, () => {
  console.log(`[api] listening on http://127.0.0.1:${PORT}`)
})
