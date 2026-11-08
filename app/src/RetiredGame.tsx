import { useEffect } from 'react'
import { useLang } from './i18n'
import { launchStartParam } from './gameLocale'

function openLink(url: string) {
  const open = (window as any).Telegram?.WebApp?.openTelegramLink
  if (open) open(url)
  else location.replace(url)
}

/** The old game is retired: jump straight to the 3D game. The screen stays as a fallback button. */
export function RetiredGame() {
  const ru = useLang() === 'ru'
  const start = launchStartParam()
  const url = `https://t.me/monopolyrubot?startapp=${encodeURIComponent(start || 'gg')}`

  useEffect(() => {
    try { openLink(url) } catch { /* the button below still works */ }
  }, [url])

  return <main className="app">
    <div className="home" style={{ justifyContent: 'center', gap: 20, paddingTop: 'max(80px, var(--gg-menu-safe-top, 0px))' }}>
      <h1>{ru ? 'Открываем 3D Monopoly…' : 'Opening 3D Monopoly…'}</h1>
      <p style={{ maxWidth: 340, lineHeight: 1.5 }}>
        {ru ? 'Если игра не открылась, нажми кнопку ниже.' : "If it didn't open, tap the button below."}
      </p>
      <a className="btn accent" href={url} style={{ textDecoration: 'none' }} onClick={e => {
        e.preventDefault()
        openLink(url)
      }}>{ru ? 'Открыть 3D Monopoly' : 'Open 3D Monopoly'}</a>
    </div>
  </main>
}
