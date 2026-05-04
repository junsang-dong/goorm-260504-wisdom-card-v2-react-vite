import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'

dotenv.config()

const PORT = Number(process.env.API_PORT) || 8787
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const SPEECH_MODEL = process.env.OPENAI_SPEECH_MODEL || 'gpt-4o-mini-tts'
const SPEECH_VOICE = process.env.OPENAI_SPEECH_VOICE || 'coral'

const SPEECH_INPUT_MAX = 4096

function speechModelSupportsInstructions(model) {
  return String(model).startsWith('gpt-4o-mini-tts')
}

/** @returns {'green'|'blue'|'red'} */
function normalizeBackgroundKey(value) {
  const k = String(value ?? '')
    .trim()
    .toLowerCase()
  if (k === 'green' || k === 'blue' || k === 'red') return k
  return 'blue'
}

function buildSystemPrompt() {
  return [
    'You output ONLY valid JSON, no markdown, no extra keys.',
    'Topic: one wisdom card about a famous person born in Korea (Korean nationality or strongly Korean heritage).',
    'Prefer well-attributed, real quotes widely cited in reliable sources. If uncertain, pick a different person/quote you are confident about.',
    'Fields: personName (Korean), achievements (Korean, 2–3 short sentences), birthYear and deathYear (integers; use null if unknown), quoteKo (Korean quote), quoteEn (faithful English translation), backgroundKey.',
    'backgroundKey must be exactly one of: green, blue, red — choose by mood of the quote: green=growth/calm/nature/hope; blue=reflection/intellect/depth/sadness; red=passion/urgency/struggle/energy.',
  ].join(' ')
}

function buildUserPrompt(body) {
  const hint =
    typeof body?.hint === 'string' && body.hint.trim()
      ? `User hint (optional): ${body.hint.trim()}`
      : 'No extra hint; pick a diverse notable figure when possible.'
  return `Return a single JSON object with keys: personName, achievements, birthYear, deathYear, quoteKo, quoteEn, backgroundKey.\n${hint}`
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/speech', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not set' })
    return
  }

  const quoteKo = String(req.body?.quoteKo ?? '').trim()
  const quoteEn = String(req.body?.quoteEn ?? '').trim()
  if (!quoteKo) {
    res.status(400).json({ error: 'quoteKo is required' })
    return
  }

  let input = quoteEn ? `${quoteKo}\n\n${quoteEn}` : quoteKo
  if (input.length > SPEECH_INPUT_MAX) {
    res.status(413).json({
      error: 'Text too long for speech',
      detail: `Maximum ${SPEECH_INPUT_MAX} characters`,
    })
    return
  }

  const model = SPEECH_MODEL
  const voice = SPEECH_VOICE

  /** @type {Record<string, unknown>} */
  const openaiBody = {
    model,
    voice,
    input,
    response_format: 'mp3',
  }

  if (speechModelSupportsInstructions(model)) {
    openaiBody.instructions =
      'Read Korean and English clearly and naturally. Take a brief pause between the Korean and English parts. Calm, respectful narrator tone.'
  }

  try {
    const speechRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(openaiBody),
    })

    const buf = Buffer.from(await speechRes.arrayBuffer())
    if (!speechRes.ok) {
      let detail = buf.toString('utf8')
      try {
        const j = JSON.parse(detail)
        detail = JSON.stringify(j)
      } catch {
        /* raw text */
      }
      res.status(502).json({
        error: 'OpenAI speech request failed',
        detail: detail.slice(0, 2000),
      })
      return
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.send(buf)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

app.post('/api/wisdom-card', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not set' })
    return
  }

  try {
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(req.body ?? {}) },
        ],
      }),
    })

    const raw = await completion.text()
    if (!completion.ok) {
      res.status(502).json({
        error: 'OpenAI request failed',
        detail: raw.slice(0, 2000),
      })
      return
    }

    /** @type {{ choices?: Array<{ message?: { content?: string } }> }} */
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      res.status(502).json({ error: 'Invalid OpenAI response' })
      return
    }

    const content = parsed?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      res.status(502).json({ error: 'Empty OpenAI message' })
      return
    }

    let card
    try {
      card = JSON.parse(content)
    } catch {
      res.status(502).json({ error: 'Model did not return JSON' })
      return
    }

    const payload = {
      personName: String(card.personName ?? '').trim() || '이름 미상',
      achievements: String(card.achievements ?? '').trim() || '',
      birthYear:
        card.birthYear === null || card.birthYear === undefined
          ? null
          : Number.isFinite(Number(card.birthYear))
            ? Number(card.birthYear)
            : null,
      deathYear:
        card.deathYear === null || card.deathYear === undefined
          ? null
          : Number.isFinite(Number(card.deathYear))
            ? Number(card.deathYear)
            : null,
      quoteKo: String(card.quoteKo ?? '').trim() || '',
      quoteEn: String(card.quoteEn ?? '').trim() || '',
      backgroundKey: normalizeBackgroundKey(card.backgroundKey),
    }

    res.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
})

app.listen(PORT, () => {
  console.log(`[api] listening on http://127.0.0.1:${PORT}`)
})
