export type BackgroundKey = 'green' | 'blue' | 'red'

export type WisdomCardPayload = {
  personName: string
  achievements: string
  birthYear: number | null
  deathYear: number | null
  quoteKo: string
  quoteEn: string
  backgroundKey: BackgroundKey
}
