import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import type { WisdomCardPayload } from '../types/wisdomCard'
import { WisdomCard } from './WisdomCard'
import styles from './QuoteCarousel.module.css'

type Props = {
  cards: WisdomCardPayload[]
  activeIndex: number
  onActiveChange: (index: number) => void
  loading?: boolean
}

export function QuoteCarousel({
  cards,
  activeIndex,
  onActiveChange,
  loading = false,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [translateX, setTranslateX] = useState(0)

  const recalc = useCallback(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return

    const firstSlide = track.querySelector<HTMLElement>(`[data-slide="0"]`)
    if (!firstSlide) return

    const slideW = firstSlide.offsetWidth
    const vw = viewport.clientWidth
    if (!slideW || !vw) return

    const gap =
      parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) ||
      16

    const centerOfActive = activeIndex * (slideW + gap) + slideW / 2
    const x = vw / 2 - centerOfActive
    setTranslateX(x)
  }, [activeIndex])

  useLayoutEffect(() => {
    recalc()
    const viewport = viewportRef.current
    if (!viewport) return

    const ro = new ResizeObserver(() => {
      recalc()
    })
    ro.observe(viewport)

    return () => ro.disconnect()
  }, [recalc, cards, loading])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onActiveChange(Math.max(0, activeIndex - 1))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onActiveChange(Math.min(2, activeIndex + 1))
    }
  }

  if (loading) {
    return (
      <div className={styles.root} aria-busy="true" aria-label="명언 카드 로딩">
        <div className={styles.skeletonRow}>
          <div className={styles.skeletonSlide} />
          <div className={styles.skeletonSlide} />
          <div className={styles.skeletonSlide} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div
        className={styles.viewport}
        ref={viewportRef}
        tabIndex={0}
        role="region"
        aria-roledescription="캐러셀"
        aria-label="명언 카드 세 장"
        onKeyDown={onKeyDown}
      >
        <div
          className={styles.track}
          ref={trackRef}
          style={{ transform: `translateX(${translateX}px)` }}
        >
          {cards.map((card, i) => (
            <div
              key={`${card.personName}-${card.quoteKo}-${i}`}
              className={styles.slide}
              data-slide={String(i)}
              role="group"
              aria-roledescription="슬라이드"
              data-active={i === activeIndex ? 'true' : 'false'}
              onClick={() => onActiveChange(i)}
            >
              <div className={styles.slideInner}>
                <WisdomCard data={card} inactive={i !== activeIndex} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
