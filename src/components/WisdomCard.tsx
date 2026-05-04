import type { WisdomCardPayload } from '../types/wisdomCard'
import { backgroundImageUrl, normalizeBackgroundKey } from '../lib/backgrounds'
import styles from './WisdomCard.module.css'

function formatLifeYears(
  birthYear: number | null,
  deathYear: number | null,
): string {
  if (birthYear === null && deathYear === null) return '생몰년 미상'
  if (birthYear !== null && deathYear !== null) return `${birthYear}–${deathYear}`
  if (birthYear !== null) return `${birthYear}–`
  return `–${deathYear}`
}

type Props = {
  data: WisdomCardPayload
  /** 캐러셀 등에서 옆 카드일 때 시각적 강조 완화 */
  inactive?: boolean
}

export function WisdomCard({ data, inactive = false }: Props) {
  const key = normalizeBackgroundKey(data.backgroundKey)
  const bgUrl = backgroundImageUrl(key)

  return (
    <article
      className={`${styles.wrap} ${inactive ? styles.inactive : ''}`}
      aria-label="명언 카드"
    >
      <div
        className={styles.bg}
        style={{ backgroundImage: `url('${bgUrl}')` }}
        aria-hidden
      />
      <div className={styles.scrim} aria-hidden />
      <div className={styles.inner}>
        <div className={styles.quotes}>
          <blockquote className={styles.quoteKo}>“{data.quoteKo}”</blockquote>
          <p className={styles.quoteEn}>{data.quoteEn}</p>
        </div>
        <div className={styles.divider} aria-hidden />
        <header className={styles.meta}>
          <h2 className={styles.name}>{data.personName}</h2>
          <p className={styles.years}>
            {formatLifeYears(data.birthYear, data.deathYear)}
          </p>
          {data.achievements ? (
            <p className={styles.achievements}>{data.achievements}</p>
          ) : null}
        </header>
      </div>
    </article>
  )
}
