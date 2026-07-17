import { useStore } from '../store'
import { Logo } from './Logo'
import { APP_NAME } from '../brand'
import { t, getLang, setLang } from '../i18n'

export function Home() {
  const profile = useStore(s => s.profile)
  const createRoom = useStore(s => s.createRoom)
  const quickMatch = useStore(s => s.quickMatch)
  const go = useStore(s => s.go)
  const busy = useStore(s => s.busy)

  const lang = getLang()
  const langBtn = (l: 'ru' | 'en', txt: string) => (
    <button
      onClick={() => setLang(l)}
      style={{
        border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 12,
        padding: '5px 11px', borderRadius: 999,
        background: lang === l ? 'var(--brown-deep, #6f4322)' : 'rgba(0,0,0,.08)',
        color: lang === l ? '#fff' : 'var(--ink-soft, #6f4322)',
      }}
    >{txt}</button>
  )

  return (
    <div className="home rise">
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, zIndex: 5 }}>
        {langBtn('ru', 'RU')}
        {langBtn('en', 'EN')}
      </div>
      <div className="brand">
        <Logo />
        <div className="brand-name">{t(APP_NAME)}</div>
        <div className="brand-tag">{t('Скупай улицы, собирай монополии, разоряй соперников')}</div>
      </div>

      {profile && (
        <div className="stat-strip">
          <div className="stat-pill"><div className="v">{profile.wins}</div><div className="l">{t('Победы')}</div></div>
          <div className="stat-pill"><div className="v">{profile.streak}</div><div className="l">{t('Серия')}</div></div>
          <div className="stat-pill"><div className="v">{profile.coins}</div><div className="l">{t('Монеты')}</div></div>
        </div>
      )}

      <div className="menu-spacer" />

      <div className="menu">
        <button className="tile primary" onClick={() => useStore.setState({ difficultyPick: true })}>
          <span className="tile-emoji">🎲</span>
          <span className="tile-text">
            <span className="tile-title">{t('Одиночная игра')}</span>
            <span className="tile-sub">{t('Против ботов, выбери сложность')}</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile" onClick={quickMatch} disabled={busy}>
          <span className="tile-emoji">⚡</span>
          <span className="tile-text">
            <span className="tile-title">{t('Быстрая игра')}</span>
            <span className="tile-sub">{t('Случайные соперники онлайн')}</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile" onClick={createRoom} disabled={busy}>
          <span className="tile-emoji">👥</span>
          <span className="tile-text">
            <span className="tile-title">{t('Игра с друзьями')}</span>
            <span className="tile-sub">{t('Создай комнату и поделись кодом')}</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <button className="tile" onClick={() => go('lobby')}>
          <span className="tile-emoji">🔢</span>
          <span className="tile-text">
            <span className="tile-title">{t('Войти по коду')}</span>
            <span className="tile-sub">{t('Введи код из 4 символов')}</span>
          </span>
          <span className="tile-chev">›</span>
        </button>

        <div style={{ display: 'flex', gap: 13 }}>
          <button className="tile" style={{ flex: 1 }} onClick={() => { go('leaderboard'); useStore.getState().loadLeaderboard() }}>
            <span className="tile-emoji">🏆</span>
            <span className="tile-text"><span className="tile-title">{t('Рейтинг')}</span></span>
          </button>
          <button className="tile" style={{ flex: 1 }} onClick={() => go('rules')}>
            <span className="tile-emoji">📖</span>
            <span className="tile-text"><span className="tile-title">{t('Правила')}</span></span>
          </button>
        </div>
      </div>
    </div>
  )
}
