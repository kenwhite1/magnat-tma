import { useMemo, useEffect } from 'react'
import { useStore } from '../store'
import { BoardScene } from '../game/BoardScene'
import { toView, type GameView } from '@shared/view'
import { BOARD, tileAt, GROUPS, RAIL_RENT, UTIL_MULT, JAIL_FINE, type Tile } from '@shared/board'
import { money } from '@shared/engine'
import { GROUP_HEX } from '../brand'
import { t } from '../i18n'

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
}

function Die({ v, rolling }: { v: number; rolling: boolean }) {
  return (
    <div className={`die${rolling ? ' rolling' : ''}`}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} style={{ visibility: PIPS[v]?.includes(i) ? 'visible' : 'hidden' }}>
          <i />
        </span>
      ))}
    </div>
  )
}

export function Board() {
  const mode = useStore(s => s.mode)
  const solo = useStore(s => s.solo)
  const youId = useStore(s => s.youId)
  const room = useStore(s => s.room)
  const rolling = useStore(s => s.rolling)
  const buildOpen = useStore(s => s.buildOpen)
  const infoTile = useStore(s => s.infoTile)
  const roll = useStore(s => s.roll)
  const jailPay = useStore(s => s.jailPay)
  const jailRoll = useStore(s => s.jailRoll)
  const buyProp = useStore(s => s.buyProp)
  const declineProp = useStore(s => s.declineProp)
  const build = useStore(s => s.build)
  const leaveGame = useStore(s => s.leaveGame)

  const view: GameView | null = useMemo(() => {
    if (mode === 'solo' && solo) return toView(solo, youId)
    if (mode === 'online' && room?.view) return room.view
    return null
  }, [mode, solo, youId, room])

  // не даём закрыть мини-апп свайпом во время партии
  useEffect(() => {}, [])

  if (!view) return null
  const me = view.players.find(p => p.id === view.youId)
  const cur = view.players[view.turn]
  const badge = mode === 'online' && room && !room.room.quick ? `${t('КОД')} ${room.room.code}` : `${t('РАУНД')} ${view.round + 1}`
  const showBuy = view.yourTurn && view.phase === 'buy' && view.pendingTile != null

  return (
    <div className="game">
      <div className="game-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="round-btn on-felt" onClick={leaveGame} aria-label={t('Выйти')}>✕</button>
          <div className="badge">{badge}</div>
        </div>
        <div className={view.yourTurn ? 'turn-tag you' : 'turn-tag'}>
          {view.yourTurn ? t('✦ Твой ход') : `${t('Ходит')} ${cur?.name ?? ''}`}
        </div>
      </div>

      <div className="players-strip">
        {view.players.map(p => (
          <div key={p.id} className={`pchip${p.id === cur?.id ? ' active' : ''}${p.bankrupt ? ' out' : ''}`}>
            <span className="dot" style={{ background: p.color }}>{p.name.slice(0, 1).toUpperCase()}</span>
            <span className="pcol">
              <span className="pn">{p.id === view.youId ? t('Ты') : p.name}{p.inJail ? ' 🔒' : ''}</span>
              <span className="pc">{p.bankrupt ? t('банкрот') : money(p.cash)}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="board-wrap">
        <div style={{ position: 'relative', width: '100%', maxWidth: 460 }}>
          <BoardScene view={view} onTapTile={id => useStore.setState({ infoTile: id })} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '56%' }}>
            {view.dice ? (
              <div className="dice-tray">
                <Die v={view.dice[0]} rolling={rolling} />
                <Die v={view.dice[1]} rolling={rolling} />
              </div>
            ) : (
              <div style={{ fontSize: 40 }}>🎲</div>
            )}
            <div style={{ fontWeight: 900, fontSize: 14, color: '#eafff2', textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>
              {view.status === 'finished' ? t('Партия окончена') : view.yourTurn ? (view.youInJail ? t('Ты в тюрьме') : t('Твой ход')) : `${cur?.name ?? ''} ${t('ходит…')}`}
            </div>
          </div>
        </div>
      </div>

      <div className="actionbar">
        <div className="act-hint">{hint(view)}</div>
        <div className="act-row">
          {view.yourTurn && view.youInJail ? (
            <>
              <button className="btn gold" style={{ flex: 1 }} onClick={jailPay}
                disabled={!me || (me.getOut === 0 && me.cash < JAIL_FINE)}>
                {me && me.getOut > 0 ? t('Выйти по карте') : `${t('Залог')} ${money(JAIL_FINE)}`}
              </button>
              <button className="btn dark" style={{ flex: 1 }} onClick={jailRoll}>{t('Бросок на дубль 🎲')}</button>
            </>
          ) : view.yourTurn && !showBuy ? (
            <>
              <button className="btn gold lg" style={{ flex: 2 }} onClick={roll} disabled={!view.canRoll}>{t('Бросить кубики 🎲')}</button>
              {view.buildableIds.length > 0 && (
                <button className="btn dark" style={{ flex: 1 }} onClick={() => useStore.setState({ buildOpen: true })}>{t('Строить 🏠')}</button>
              )}
            </>
          ) : (
            <div className="wallet" style={{ margin: '0 auto' }}><span className="lab">{t('Твой капитал')}</span> {me ? money(me.cash) : '0 ₽'}</div>
          )}
        </div>
        {(view.yourTurn && !view.youInJail && !showBuy) && (
          <div className="wallet"><span className="lab">{t('Капитал')}</span> {me ? money(me.cash) : '0 ₽'}</div>
        )}
      </div>

      {showBuy && <BuySheet view={view} onBuy={buyProp} onDecline={declineProp} />}
      {buildOpen && <BuildSheet view={view} onBuild={build} onClose={() => useStore.setState({ buildOpen: false })} />}
      {infoTile != null && <InfoSheet tileId={infoTile} view={view} onClose={() => useStore.setState({ infoTile: null })} />}
    </div>
  )
}

function hint(v: GameView): string {
  if (v.status === 'finished') return ''
  if (!v.yourTurn) return t('Ждём ход соперника…')
  if (v.youInJail) return t('Заплати залог или попробуй выбросить дубль')
  if (v.phase === 'buy') return t('Купишь недвижимость?')
  if (v.buildableIds.length > 0) return t('Можно бросить кубики или построить дом')
  return t('Бросай кубики и ходи по кругу')
}

// -- листы --------------------------------------------------------------------
function BandTitle({ tile }: { tile: Tile }) {
  const color = tile.group ? GROUP_HEX[tile.group] : '#8a5a33'
  return <div className="prop-band" style={{ background: color }}>{t(tile.name)}</div>
}

const RAIL_LABELS = ['1 вокзал', '2 вокзала', '3 вокзала', '4 вокзала']

function rentRows(tile: Tile): { label: string; value: string; hot?: boolean }[] {
  if (tile.type === 'prop' && tile.rent) {
    return [
      { label: t('Аренда'), value: money(tile.rent[0]) },
      { label: t('Монополия (без домов)'), value: money(tile.rent[0] * 2) },
      { label: t('1 дом'), value: money(tile.rent[1]) },
      { label: t('2 дома'), value: money(tile.rent[2]) },
      { label: t('3 дома'), value: money(tile.rent[3]) },
      { label: t('4 дома'), value: money(tile.rent[4]) },
      { label: t('Отель'), value: money(tile.rent[5]), hot: true },
    ]
  }
  if (tile.type === 'rail') {
    return RAIL_RENT.map((r, i) => ({ label: t(RAIL_LABELS[i]), value: money(r) }))
  }
  if (tile.type === 'util') {
    return [
      { label: t('1 предприятие'), value: `${t('бросок')} ×${UTIL_MULT[0]}` },
      { label: t('2 предприятия'), value: `${t('бросок')} ×${UTIL_MULT[1]}` },
    ]
  }
  return []
}

function specialDesc(tile: Tile): string {
  switch (tile.type) {
    case 'go': return t('Проходя мимо, получаешь зарплату 2000 ₽.')
    case 'jail': return t('Просто стоишь в гостях, если не попал за решётку.')
    case 'parking': return t('Спокойная клетка. Ничего не происходит, можно выдохнуть.')
    case 'gojail': return t('Отправляешься прямиком на нары.')
    case 'chance': return t('Тянешь карту «Шанс»: движение, штраф или удача.')
    case 'chest': return t('Тянешь карту «Казна»: чаще про деньги.')
    case 'tax': return `${t('Платишь налог')} ${money(tile.tax ?? 0)} ${t('в банк.')}`
    default: return ''
  }
}

function InfoSheet({ tileId, view, onClose }: { tileId: number; view: GameView; onClose: () => void }) {
  const tile = tileAt(tileId)
  const owner = view.owners[tileId]
  const ownerP = owner ? view.players.find(p => p.id === owner) : undefined
  const rows = rentRows(tile)
  const buyable = tile.type === 'prop' || tile.type === 'rail' || tile.type === 'util'
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="prop-card">
          {buyable ? <BandTitle tile={tile} /> : <div className="prop-band" style={{ background: '#8a5a33' }}>{t(tile.name)}</div>}
          <div className="prop-body">
            {buyable ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>{t('Цена')}</span>
                  <span className="big-price">{money(tile.price ?? 0)}</span>
                </div>
                <table className="rent-table">
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r.hot ? 'hot' : ''}><td>{r.label}</td><td>{r.value}</td></tr>
                    ))}
                  </tbody>
                </table>
                {tile.type === 'prop' && (
                  <div style={{ marginTop: 8, fontWeight: 800, color: 'var(--ink-soft)', fontSize: 13 }}>
                    {t('Дом:')} {money(tile.houseCost ?? 0)} · {t('строить можно на полной группе')}
                  </div>
                )}
                <div className="owner-line">
                  {ownerP ? (
                    <><span className="odot" style={{ background: ownerP.color }} /> {t('Владелец:')} {ownerP.id === view.youId ? t('ты') : ownerP.name}{view.mortgaged[tileId] ? ` · ${t('в залоге')}` : ''}</>
                  ) : (
                    <>{t('Пока ничей')}</>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.45, margin: '4px 0 6px' }}>{specialDesc(tile)}</p>
            )}
          </div>
        </div>
        <button className="btn cream block" style={{ marginTop: 14 }} onClick={onClose}>{t('Закрыть')}</button>
      </div>
    </div>
  )
}

function BuySheet({ view, onBuy, onDecline }: { view: GameView; onBuy: () => void; onDecline: () => void }) {
  const tile = tileAt(view.pendingTile!)
  const rows = rentRows(tile)
  return (
    <div className="scrim">
      <div className="sheet">
        <div className="sheet-grip" />
        <h2 style={{ textAlign: 'center', marginBottom: 12 }}>{t('Свободная недвижимость')}</h2>
        <div className="prop-card">
          <BandTitle tile={tile} />
          <div className="prop-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>{t('Цена')}</span>
              <span className="big-price">{money(tile.price ?? 0)}</span>
            </div>
            <table className="rent-table">
              <tbody>
                {rows.slice(0, tile.type === 'prop' ? 3 : rows.length).map((r, i) => (
                  <tr key={i}><td>{r.label}</td><td>{r.value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <button className="btn gold block lg" style={{ marginTop: 14 }} onClick={onBuy} disabled={!view.canBuyPending}>
          {view.canBuyPending ? `${t('Купить за')} ${money(tile.price ?? 0)}` : t('Не хватает денег')}
        </button>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={onDecline}>{t('Пропустить')}</button>
      </div>
    </div>
  )
}

function BuildSheet({ view, onBuild, onClose }: { view: GameView; onBuild: (id: number) => void; onClose: () => void }) {
  const items = view.buildableIds.map(id => BOARD[id])
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2 style={{ textAlign: 'center', marginBottom: 4 }}>{t('Построить дом 🏠')}</h2>
        <p style={{ textAlign: 'center', color: 'var(--ink-soft)', fontWeight: 800, marginTop: 0, marginBottom: 14, fontSize: 14 }}>
          {t('Дома поднимают аренду. Пятый дом это отель.')}
        </p>
        {items.length === 0 ? (
          <p className="act-hint" style={{ color: 'var(--ink-soft)' }}>{t('Пока строить негде.')}</p>
        ) : (
          items.map(item => {
            const h = view.houses[item.id] ?? 0
            return (
              <button key={item.id} className="build-item" onClick={() => onBuild(item.id)}>
                <span className="bband" style={{ background: item.group ? GROUP_HEX[item.group] : '#8a5a33' }} />
                <span className="bt">
                  <span className="bn">{t(item.name)}</span>
                  <span className="bh">{h >= 4 ? t('станет отелем') : `${t('сейчас')} ${h} ${t(h === 1 ? 'дом' : 'дома')}`} · {t(GROUPS[item.group!].label)}</span>
                </span>
                <span className="bc">{money(item.houseCost ?? 0)}</span>
              </button>
            )
          })
        )}
        <button className="btn cream block" style={{ marginTop: 8 }} onClick={onClose}>{t('Закрыть')}</button>
      </div>
    </div>
  )
}
