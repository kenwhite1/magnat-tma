import { useLang } from './i18n'
import { launchStartParam } from './gameLocale'

/** Keep historical saves, but send new players to the maintained 3D game. */
export function RetiredGame() {
  const ru = useLang() === 'ru'
  const start = launchStartParam()
  const url = `https://t.me/monopolyrubot?startapp=${encodeURIComponent(start || 'gg')}`
  return <main className="app">
    <div className="home" style={{ justifyContent: 'center', gap: 20, paddingTop: 'max(80px, var(--gg-menu-safe-top, 0px))' }}>
      <h1>{ru ? 'Теперь играем в 3D Monopoly' : 'Play 3D Monopoly'}</h1>
      <p style={{ maxWidth: 340, lineHeight: 1.5 }}>
        {ru ? 'Старая игра Rentlord закрыта. Продолжай играть в новой 3D-версии.' : 'The old Rentlord game has been retired. Continue with the 3D version.'}
      </p>
      <a className="btn accent" href={url} style={{ textDecoration: 'none' }} onClick={e => {
        const open = (window as any).Telegram?.WebApp?.openTelegramLink
        if (open) { e.preventDefault(); open(url) }
      }}>{ru ? 'Открыть 3D Monopoly' : 'Open 3D Monopoly'}</a>
    </div>
  </main>
}
