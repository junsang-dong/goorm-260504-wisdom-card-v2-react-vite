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

/** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res */
export function handleHealth(_req, res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true }))
}

/**
 * Vercel/Node에서 JSON 본문이 아직 객체가 아닐 때 파싱
 * @param {import('http').IncomingMessage} req
 */
export async function ensureJsonBody(req) {
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res */
export async function handleSpeech(req, res) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set' }))
    return
  }

  const body = await ensureJsonBody(req)
  const quoteKo = String(body?.quoteKo ?? '').trim()
  const quoteEn = String(body?.quoteEn ?? '').trim()
  if (!quoteKo) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'quoteKo is required' }))
    return
  }

  let input = quoteEn ? `${quoteKo}\n\n${quoteEn}` : quoteKo
  if (input.length > SPEECH_INPUT_MAX) {
    res.statusCode = 413
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'Text too long for speech',
        detail: `Maximum ${SPEECH_INPUT_MAX} characters`,
      }),
    )
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
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: 'OpenAI speech request failed',
          detail: detail.slice(0, 2000),
        }),
      )
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.end(buf)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: message }))
  }
}

/** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res */
export async function handleWisdomCard(req, res) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set' }))
    return
  }

  const body = await ensureJsonBody(req)

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
          { role: 'user', content: buildUserPrompt(body ?? {}) },
        ],
      }),
    })

    const raw = await completion.text()
    if (!completion.ok) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: 'OpenAI request failed',
          detail: raw.slice(0, 2000),
        }),
      )
      return
    }

    /** @type {{ choices?: Array<{ message?: { content?: string } }> }} */
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Invalid OpenAI response' }))
      return
    }

    const content = parsed?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Empty OpenAI message' }))
      return
    }

    let card
    try {
      card = JSON.parse(content)
    } catch {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Model did not return JSON' }))
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

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(payload))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: message }))
  }
}
