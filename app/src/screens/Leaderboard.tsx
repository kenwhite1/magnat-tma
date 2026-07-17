import { useStore } from '../store'
import { t } from '../i18n'

export function Leaderboard() {
  const go = useStore(s => s.go)
  const rows = useStore(s => s.leaderboard)
  const profile = useStore(s => s.profile)

  return (
    <div className="page rise">
      <div className="page-head">
        <button className="round-btn" onClick={() => go('home')}>‹</button>
        <h1>{t('Рейтинг 🏆')}</h1>
      </div>

      {profile && (
        <div className="code-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--brown-deep)' }}>{profile.wins}</div><div style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>{t('Победы')}</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--brown-deep)' }}>{profile.played}</div><div style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>{t('Партий')}</div></div>
            <div><div style={{ fontSize: 26, fontWeight: 900, color: 'var(--brown-deep)' }}>{profile.bestStreak}</div><div style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>{t('Лучшая серия')}</div></div>
          </div>
        </div>
      )}

      <div className="board">
        {rows.length === 0 ? (
          <div className="code-card" style={{ textAlign: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 52 }}>🎩</div>
            <h2 style={{ color: 'var(--ink)', marginTop: 6 }}>{t('Таблица пока пуста')}</h2>
            <p style={{ color: 'var(--ink-soft)', fontWeight: 800, marginTop: 6 }}>{t('Сыграй партию и стань первым магнатом в рейтинге!')}</p>
            <button className="btn gold block" style={{ marginTop: 14 }} onClick={() => { useStore.getState().go('home'); useStore.setState({ difficultyPick: true }) }}>{t('Сыграть 🎲')}</button>
          </div>
        ) : (
          rows.map((r, i) => (
            <div className="board-row" key={i}>
              <div className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
              <div className="nm">{r.name}</div>
              <div className="wins">{r.wins}<span style={{ opacity: .6, fontWeight: 800, fontSize: 12 }}>{t(' побед')}</span></div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
