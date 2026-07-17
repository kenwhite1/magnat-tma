import { useEffect } from 'react'
import { useStore } from './store'
import { Home } from './screens/Home'
import { Board } from './screens/Board'
import { Lobby } from './screens/Lobby'
import { Rules } from './screens/Rules'
import { Leaderboard } from './screens/Leaderboard'
import { Logo } from './screens/Logo'
import { APP_NAME } from './brand'
import { t, useLang } from './i18n'
import type { Difficulty } from '@shared/bots'

const CONFETTI = ['#e05a4d', '#3d8be0', '#54b15a', '#f0b429', '#f8d77e']
const DIFFS: { d: Difficulty; label: string; s: string; emoji: string }[] = [
  { d: 'easy', label: 'Легко', s: 'Спокойная партия', emoji: '🌱' },
  { d: 'medium', label: 'Средне', s: 'Достойные соперники', emoji: '🎯' },
  { d: 'hard', label: 'Сложно', s: 'Безжалостные магнаты', emoji: '🔥' },
]

export function App() {
  useLang()
  const ready = useStore(s => s.ready)
  const screen = useStore(s => s.screen)
  const init = useStore(s => s.init)

  useEffect(() => { init() }, [init])

  if (!ready) {
    return (
      <div className="app">
        <div className="home" style={{ justifyContent: 'center' }}>
          <div className="brand" style={{ animation: 'pop-in .5s ease both' }}>
            <Logo />
            <div className="brand-name">{t(APP_NAME)}</div>
            <div className="brand-tag">{t('Раскладываем поле…')}</div>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'game') {
    return (<><Board /><Overlays /></>)
  }

  return (
    <div className="app">
      {screen === 'home' && <Home />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'rules' && <Rules />}
      {screen === 'leaderboard' && <Leaderboard />}
      <Overlays />
    </div>
  )
}

function Overlays() {
  const difficultyPick = useStore(s => s.difficultyPick)
  const reveal = useStore(s => s.reveal)
  const result = useStore(s => s.result)
  const toast = useStore(s => s.toast)
  const fly = useStore(s => s.fly)
  const startSolo = useStore(s => s.startSolo)

  return (
    <>
      {toast && <div className="toast">{toast}</div>}
      {fly && <div className="flychip" style={{ color: fly.tone === 'bad' ? '#ff9b8f' : '#a6f0c0' }}>{fly.text}</div>}

      {difficultyPick && (
        <div className="scrim center" onClick={() => useStore.setState({ difficultyPick: false })}>
          <div className="sheet pop" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 44, textAlign: 'center' }}>🎲</div>
            <h2 style={{ textAlign: 'center', marginTop: 2 }}>{t('Выбери сложность')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 16 }}>
              {DIFFS.map(({ d, label, s, emoji }) => (
                <button key={d} className="tile" onClick={() => startSolo(d)}>
                  <span className="tile-emoji">{emoji}</span>
                  <span className="tile-text">
                    <span className="tile-title">{t(label)}</span>
                    <span className="tile-sub">{t(s)}</span>
                  </span>
                  <span className="tile-chev">›</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {reveal && (
        <div className="scrim center" onClick={() => useStore.setState({ reveal: null })}>
          <div className="sheet pop reveal" onClick={e => e.stopPropagation()}>
            <span className={`reveal-badge ${reveal.deck}`}>{reveal.deck === 'chance' ? t('Шанс') : t('Казна')}</span>
            <div className="reveal-emoji">{reveal.deck === 'chance' ? '❓' : '💰'}</div>
            <div className="reveal-text">{t(reveal.text)}</div>
            <button className="btn cream block" style={{ marginTop: 14 }} onClick={() => useStore.setState({ reveal: null })}>{t('Понятно')}</button>
          </div>
        </div>
      )}

      {result && <ResultModal />}
    </>
  )
}

function ResultModal() {
  const result = useStore(s => s.result)!
  const mode = useStore(s => s.mode)
  const startSolo = useStore(s => s.startSolo)
  const leaveGame = useStore(s => s.leaveGame)
  const won = result.won

  return (
    <div className="scrim center">
      {won && (
        <div className="confetti">
          {Array.from({ length: 42 }).map((_, i) => (
            <i key={i} style={{ left: `${(i * 137) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 10) * 0.12}s`, transform: `rotate(${i * 35}deg)` }} />
          ))}
        </div>
      )}
      <div className="sheet pop result">
        <div className="result-emoji">{won ? '🎩' : '🃏'}</div>
        <h1>{won ? t('Ты магнат!') : `${t('Победил')} ${result.winnerName}`}</h1>
        <div className="result-sub">{won ? t('Ты разорил соперников и остался на вершине.') : t('В следующий раз повезёт больше!')}</div>
        {won && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <span className="coin-chip">🪙 +{25 + Math.round(result.score / 4)} {t('монет')}</span>
          </div>
        )}
        <button className="btn gold block lg" onClick={mode === 'online' ? leaveGame : () => startSolo()}>
          {mode === 'online' ? t('В меню') : t('Играть ещё 🎲')}
        </button>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={leaveGame}>{t('Домой')}</button>
      </div>
    </div>
  )
}
