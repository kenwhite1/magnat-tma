// Thin typed wrapper over the Telegram WebApp bridge; safe no-ops outside Telegram.
interface TgWebApp {
  initData: string
  initDataUnsafe: { user?: { id: number; first_name: string }; start_param?: string }
  colorScheme: 'light' | 'dark'
  ready(): void
  expand(): void
  isVersionAtLeast(v: string): boolean
  disableVerticalSwipes?(): void
  enableClosingConfirmation(): void
  setHeaderColor(c: string): void
  setBackgroundColor(c: string): void
  openTelegramLink?(url: string): void
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void }
}

declare global {
  interface Window { Telegram?: { WebApp: TgWebApp } }
}

export const tg: TgWebApp | null = window.Telegram?.WebApp ?? null
export const inTelegram = !!tg && tg.initData.length > 0

const MENU_BG = '#f3e2bc'
const FELT = '#17553f'

// Подкрасить хром Telegram под текущий экран: тёплое меню или зелёный стол.
export function setChrome(scene: 'menu' | 'game') {
  if (!tg) return
  const c = scene === 'game' ? FELT : MENU_BG
  try {
    tg.setHeaderColor(c)
    tg.setBackgroundColor(c)
  } catch { /* older clients */ }
}

export function initTelegram() {
  if (!tg) return
  try {
    tg.ready()
    tg.expand()
    tg.setHeaderColor(MENU_BG)
    tg.setBackgroundColor(MENU_BG)
    if (tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes?.()
  } catch { /* older clients */ }
}

export function haptic(kind: 'tap' | 'select' | 'success' | 'warn' | 'heavy' = 'tap') {
  const h = tg?.HapticFeedback
  if (!h) return
  try {
    if (kind === 'tap') h.impactOccurred('light')
    else if (kind === 'heavy') h.impactOccurred('rigid')
    else if (kind === 'select') h.selectionChanged()
    else if (kind === 'success') h.notificationOccurred('success')
    else h.notificationOccurred('warning')
  } catch { /* ignore */ }
}

export function getInitData(): string {
  return tg?.initData ?? ''
}

export function getStartParam(): string | null {
  return tg?.initDataUnsafe?.start_param ?? null
}

// Open a t.me/share/url forward dialog; works on every client.
export function shareLink(url: string, text: string): void {
  const u = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  try {
    if (tg?.openTelegramLink) tg.openTelegramLink(u)
    else window.open(u, '_blank')
  } catch { /* ignore */ }
}

export function backButton(onClick: (() => void) | null): void {
  const b = tg?.BackButton
  if (!b) return
  try {
    if (onClick) {
      b.show()
      b.onClick(onClick)
    } else {
      b.hide()
    }
  } catch { /* ignore */ }
}
