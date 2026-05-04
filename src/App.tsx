import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { QuoteCarousel } from './components/QuoteCarousel'
import type { WisdomCardPayload } from './types/wisdomCard'
import './App.css'

type ApiError = { error?: string; detail?: string }

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 10v4c0 .55.45 1 1 1h3l4 4V5L7 9H4c-.55 0-1 .45-1 1zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 4.45v15.1c2.87-.65 5-3.19 5-6.05s-2.13-5.4-5-6.05z" />
    </svg>
  )
}

async function fetchWisdomCard(hint?: string): Promise<WisdomCardPayload> {
  const res = await fetch('/api/wisdom-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hint ? { hint } : {}),
  })
  const text = await res.text()
  let json: WisdomCardPayload | ApiError
  try {
    json = JSON.parse(text) as WisdomCardPayload | ApiError
  } catch {
    throw new Error(text.slice(0, 400) || '응답을 해석할 수 없습니다.')
  }
  if (!res.ok) {
    const err = json as ApiError
    throw new Error(
      [err.error, err.detail].filter(Boolean).join(' — ') ||
        `요청 실패 (${res.status})`,
    )
  }
  return json as WisdomCardPayload
}

function App() {
  const [cards, setCards] = useState<WisdomCardPayload[] | null>(null)
  const [activeIndex, setActiveIndex] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsPlaying, setTtsPlaying] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    audioRef.current = null
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setTtsPlaying(false)
  }, [])

  useEffect(() => {
    return () => {
      stopPlayback()
    }
  }, [stopPlayback])

  useEffect(() => {
    const id = window.setTimeout(() => {
      stopPlayback()
      setTtsError(null)
    }, 0)
    return () => window.clearTimeout(id)
  }, [activeIndex, cards, stopPlayback])

  const load = useCallback(async () => {
    stopPlayback()
    setLoading(true)
    setError(null)
    try {
      const batchId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now())
      const hints = [
        `carousel-left-${batchId}`,
        `carousel-center-${batchId}`,
        `carousel-right-${batchId}`,
      ]
      const results = await Promise.all(hints.map((h) => fetchWisdomCard(h)))
      setCards(results)
      setActiveIndex(1)
    } catch (e) {
      setCards(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [stopPlayback])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  const activeCard = useMemo(
    () =>
      cards && cards.length === 3 ? (cards[activeIndex] ?? null) : null,
    [cards, activeIndex],
  )

  const canRead =
    !loading &&
    Boolean(activeCard?.quoteKo) &&
    !ttsLoading

  const playOrStopTts = useCallback(async () => {
    if (ttsLoading) return

    const playing = audioRef.current && !audioRef.current.paused
    if (playing) {
      stopPlayback()
      return
    }

    if (!activeCard?.quoteKo) return

    stopPlayback()
    setTtsLoading(true)
    setTtsError(null)

    try {
      const res = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteKo: activeCard.quoteKo,
          quoteEn: activeCard.quoteEn ?? '',
        }),
      })

      const blob = await res.blob()
      if (!res.ok) {
        let msg = `음성 요청 실패 (${res.status})`
        try {
          const t = await blob.text()
          const j = JSON.parse(t) as ApiError
          if (j.error) msg = [j.error, j.detail].filter(Boolean).join(' — ')
        } catch {
          /* ignore */
        }
        throw new Error(msg)
      }

      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url

      const next = new Audio(url)
      audioRef.current = next

      next.onended = () => {
        stopPlayback()
      }
      next.onerror = () => {
        setTtsError('오디오를 재생할 수 없습니다.')
        stopPlayback()
      }

      await next.play().catch((e: unknown) => {
        const m = e instanceof Error ? e.message : String(e)
        throw new Error(m || '재생을 시작할 수 없습니다.')
      })
      setTtsPlaying(true)
    } catch (e) {
      setTtsError(e instanceof Error ? e.message : String(e))
      stopPlayback()
    } finally {
      setTtsLoading(false)
    }
  }, [activeCard, stopPlayback, ttsLoading])

  const readLabel = ttsPlaying ? '중지' : '읽기'
  const readTitle = ttsError
    ? ttsError
    : ttsPlaying
      ? '음성 재생 중지'
      : '현재 카드 명언 음성 듣기'

  return (
    <div className="app">
      <header className="cardHeaderBar" aria-label="앱 헤더">
        <h1 className="cardHeaderTitle">명언 카드</h1>
        <div className="cardHeaderActions">
          <button
            type="button"
            className="headerActionBtn"
            title="찜하기 (준비 중)"
            aria-label="찜하기, 추후 제공"
          >
            찜
          </button>
          <button
            type="button"
            className="headerActionBtn"
            title="공유하기 (준비 중)"
            aria-label="공유하기, 추후 제공"
          >
            공유
          </button>
          <button
            type="button"
            className={`headerActionBtn headerActionBtn--tts${ttsPlaying ? ' headerActionBtn--ttsActive' : ''}`}
            title={readTitle}
            aria-label={readTitle}
            aria-busy={ttsLoading}
            disabled={!canRead && !ttsPlaying}
            onClick={() => void playOrStopTts()}
          >
            <SpeakerIcon className="headerActionBtn__icon" />
            <span className="headerActionBtn__label">
              {ttsLoading ? '…' : readLabel}
            </span>
          </button>
        </div>
      </header>

      {ttsError ? (
        <p className="ttsErrorBanner" role="status">
          {ttsError}
        </p>
      ) : null}

      <main className="appMain">
        {error ? (
          <div className="errorBox" role="alert">
            <p className="errorTitle">문제가 발생했습니다</p>
            <p className="errorMsg">{error}</p>
          </div>
        ) : null}

        {!error && (loading || (cards && cards.length === 3)) ? (
          <QuoteCarousel
            cards={cards ?? []}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            loading={loading}
          />
        ) : null}

        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => void load()}
            disabled={loading}
          >
            다른 명언
          </button>
        </div>

        <p className="appFootnote">
          한국 태생 유명인의 명언을 카드로 만나 보세요. 배경은 명언의 분위기에
          맞춰 자동으로 선택됩니다.
        </p>
      </main>
    </div>
  )
}

export default App
