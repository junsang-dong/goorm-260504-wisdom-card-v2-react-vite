import type { BackgroundKey } from '../types/wisdomCard'

const FILES: Record<BackgroundKey, string> = {
  green: 'BG-IMG-01-GREEN-kseniya-lapteva-K0wseIXrs3I-unsplash.jpg',
  blue: 'BG-IMG-02-BLUE-a-i-iYdycsFWMK0-unsplash.jpg',
  red: 'BG-IMG-03-RED-wolfgang-hasselmann-pstlHwMpqaM-unsplash.jpg',
}

export function normalizeBackgroundKey(value: unknown): BackgroundKey {
  const k = String(value ?? '')
    .trim()
    .toLowerCase()
  if (k === 'green' || k === 'blue' || k === 'red') return k
  return 'blue'
}

export function backgroundImageUrl(key: BackgroundKey): string {
  return `/backgrounds/${FILES[key]}`
}
