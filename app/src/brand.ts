// Название приложения в одном месте, чтобы переименовать было просто.
export const APP_NAME = 'Магнат'

import type { Group } from '@shared/board'

// Цвета цветных групп для интерфейса (совпадают с CSS-переменными).
export const GROUP_HEX: Record<Group, string> = {
  brown: '#8d5a2b',
  lightblue: '#6fb7d8',
  pink: '#d24e8f',
  orange: '#ef8f2a',
  red: '#d9433a',
  yellow: '#e8bd2b',
  rail: '#3a3f52',
  util: '#5aa06a',
}

// Аватар-эмодзи по имени игрока (стабильно).
const TOKENS = ['🎩', '🚗', '🐶', '🐱', '🚢', '🥾', '⭐', '🔔']
export function tokenEmoji(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TOKENS[h % TOKENS.length]
}
