// Классическое квадратное поле: 4 угла + по 6 клеток на каждой стороне.
// Всё считается из геометрии, токены игроков рисуются поверх отдельным слоем.
import { BOARD, type Tile } from '@shared/board'
import { GROUP_HEX } from '../brand'
import type { GameView } from '@shared/view'

const W = 1000
const C = 150 // угол
const SW = (W - 2 * C) / 6 // длина боковой клетки

interface Rect { x: number; y: number; w: number; h: number; band: 'top' | 'right' | 'bottom' | 'left' | null }

function rectFor(i: number): Rect {
  if (i === 0) return { x: 0, y: 850, w: 150, h: 150, band: null }
  if (i <= 6) return { x: 0, y: 850 - i * SW, w: 150, h: SW, band: 'right' }
  if (i === 7) return { x: 0, y: 0, w: 150, h: 150, band: null }
  if (i <= 13) return { x: 150 + (i - 8) * SW, y: 0, w: SW, h: 150, band: 'bottom' }
  if (i === 14) return { x: 850, y: 0, w: 150, h: 150, band: null }
  if (i <= 20) return { x: 850, y: 150 + (i - 15) * SW, w: 150, h: SW, band: 'left' }
  if (i === 21) return { x: 850, y: 850, w: 150, h: 150, band: null }
  return { x: 850 - SW - (i - 22) * SW, y: 850, w: SW, h: 150, band: 'top' }
}

const SPECIAL: Record<string, { emoji: string; label: string }> = {
  go: { emoji: '🏁', label: 'СТАРТ' },
  jail: { emoji: '🔒', label: 'Тюрьма' },
  parking: { emoji: '☕', label: 'Отдых' },
  gojail: { emoji: '👮', label: 'На нары' },
  chance: { emoji: '❓', label: 'Шанс' },
  chest: { emoji: '💰', label: 'Казна' },
  tax: { emoji: '💸', label: '' },
}

function bandRect(r: Rect): { x: number; y: number; w: number; h: number } {
  const t = 30
  switch (r.band) {
    case 'right': return { x: r.x + r.w - t, y: r.y, w: t, h: r.h }
    case 'left': return { x: r.x, y: r.y, w: t, h: r.h }
    case 'bottom': return { x: r.x, y: r.y + r.h - t, w: r.w, h: t }
    case 'top': return { x: r.x, y: r.y, w: r.w, h: t }
    default: return { x: r.x, y: r.y, w: r.w, h: 0 }
  }
}

function tokenCenter(r: Rect): { cx: number; cy: number } {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 }
}

export function BoardScene({ view, onTapTile }: { view: GameView; onTapTile: (id: number) => void }) {
  // сгруппировать игроков по клетке для раскладки токенов
  const byTile = new Map<number, typeof view.players>()
  for (const p of view.players) {
    if (p.bankrupt) continue
    const arr = byTile.get(p.pos) ?? []
    arr.push(p)
    byTile.set(p.pos, arr)
  }
  const curId = view.players[view.turn]?.id

  return (
    <svg className="gameboard" viewBox={`0 0 ${W} ${W}`} xmlns="http://www.w3.org/2000/svg">
      {/* деревянная рамка + фетр в центре */}
      <rect x="0" y="0" width={W} height={W} rx="34" fill="#e9d8b4" />
      <rect x="6" y="6" width={W - 12} height={W - 12} rx="28" fill="none" stroke="#c8ad7d" strokeWidth="3" />
      <rect x={C} y={C} width={W - 2 * C} height={W - 2 * C} rx="14" fill="#1f6f52" />
      <rect x={C} y={C} width={W - 2 * C} height={W - 2 * C} rx="14" fill="url(#feltglow)" />
      <defs>
        <radialGradient id="feltglow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#2f8e6a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#144030" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* диагональная подпись на фетре */}
      <text x="500" y="470" textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="900"
        fontSize="118" fill="#ffffff" opacity="0.07" transform="rotate(-45 500 500)">МАГНАТ</text>

      {/* клетки */}
      {BOARD.map(tile => (
        <TileCell key={tile.id} tile={tile} view={view} onTap={onTapTile} />
      ))}

      {/* токены игроков */}
      {[...byTile.entries()].map(([pos, plist]) => {
        const r = rectFor(pos)
        const { cx, cy } = tokenCenter(r)
        return plist.map((p, idx) => {
          const n = plist.length
          const off = 26
          const dx = n === 1 ? 0 : (idx % 2 === 0 ? -off : off)
          const dy = n <= 2 ? 0 : (idx < 2 ? -off : off)
          const active = p.id === curId
          return (
            <g key={p.id} className="token" transform={`translate(${cx + dx} ${cy + dy})`}>
              <circle r="30" fill="rgba(0,0,0,.28)" cx="0" cy="4" />
              <circle r="27" fill={p.color} stroke="#fff" strokeWidth="4" />
              {active && <circle r="34" fill="none" stroke="#f8d77e" strokeWidth="5" opacity="0.9" />}
              <text x="0" y="9" textAnchor="middle" fontSize="26" fontWeight="900" fill="#fff"
                fontFamily="Nunito, sans-serif">{p.name.slice(0, 1).toUpperCase()}</text>
            </g>
          )
        })
      })}
    </svg>
  )
}

function TileCell({ tile, view, onTap }: { tile: Tile; view: GameView; onTap: (id: number) => void }) {
  const r = rectFor(tile.id)
  const owner = view.owners[tile.id]
  const ownerColor = owner ? view.players.find(p => p.id === owner)?.color : undefined
  const houses = view.houses[tile.id] ?? 0
  const mortgaged = !!view.mortgaged[tile.id]
  const isCorner = r.band === null
  const bandColor = tile.group ? GROUP_HEX[tile.group] : undefined
  const special = SPECIAL[tile.type]
  const { cx, cy } = tokenCenter(r)

  return (
    <g onClick={() => onTap(tile.id)} style={{ cursor: 'pointer' }}>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="9" fill="#fbf3e0"
        stroke={ownerColor ?? '#d8c39a'} strokeWidth={ownerColor ? 7 : 2} />

      {/* цветная полоса группы / вокзала / предприятия */}
      {r.band && bandColor && (() => {
        const b = bandRect(r)
        return <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={bandColor} opacity={mortgaged ? 0.3 : 1}
          rx="3" />
      })()}

      {/* содержимое */}
      {isCorner ? (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="52">{special?.emoji}</text>
          <text x={cx} y={cy + 40} textAnchor="middle" fontSize="24" fontWeight="900" fill="#6f4322"
            fontFamily="Nunito, sans-serif">{special?.label}</text>
          {tile.type === 'go' && (
            <text x={cx} y={cy + 66} textAnchor="middle" fontSize="20" fontWeight="800" fill="#4f9145"
              fontFamily="Nunito, sans-serif">+2000</text>
          )}
        </>
      ) : tile.type === 'prop' ? (
        <TileText r={r} lines={[tile.short]} price={tile.price} />
      ) : (
        <>
          <TileEmoji r={r} emoji={special?.emoji ?? '•'} />
          <TileText r={r} lines={[tile.type === 'tax' ? tile.short : tile.short]} price={tile.price ?? tile.tax} below />
        </>
      )}

      {/* дома / отель на улицах */}
      {tile.type === 'prop' && houses > 0 && <Houses r={r} houses={houses} />}

      {/* залог */}
      {mortgaged && (
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="20" fontWeight="900" fill="#b23b2f"
          fontFamily="Nunito, sans-serif" opacity="0.85">залог</text>
      )}
    </g>
  )
}

// текст названия/цены, смещённый от цветной полосы к центру клетки
function TileText({ r, lines, price, below }: { r: Rect; lines: string[]; price?: number; below?: boolean }) {
  // область без полосы
  let tx = r.x + r.w / 2
  let ty = r.y + r.h / 2
  const t = 30
  if (r.band === 'right') tx = r.x + (r.w - t) / 2
  if (r.band === 'left') tx = r.x + t + (r.w - t) / 2
  if (r.band === 'bottom') ty = r.y + (r.h - t) / 2
  if (r.band === 'top') ty = r.y + t + (r.h - t) / 2
  const nameY = below ? ty + 16 : ty - 2
  return (
    <>
      {lines.map((l, i) => (
        <text key={i} x={tx} y={nameY + i * 22} textAnchor="middle" fontSize="21" fontWeight="900"
          fill="#5c4326" fontFamily="Nunito, sans-serif">{l}</text>
      ))}
      {price != null && (
        <text x={tx} y={nameY + lines.length * 22 + 2} textAnchor="middle" fontSize="19" fontWeight="800"
          fill="#8a5a33" fontFamily="Nunito, sans-serif">{price}</text>
      )}
    </>
  )
}

function TileEmoji({ r, emoji }: { r: Rect; emoji: string }) {
  let tx = r.x + r.w / 2
  let ty = r.y + r.h / 2
  const t = 30
  if (r.band === 'right') tx = r.x + (r.w - t) / 2
  if (r.band === 'left') tx = r.x + t + (r.w - t) / 2
  if (r.band === 'bottom') ty = r.y + (r.h - t) / 2 - 10
  if (r.band === 'top') ty = r.y + t + (r.h - t) / 2 - 10
  return <text x={tx} y={ty} textAnchor="middle" fontSize="34">{emoji}</text>
}

function Houses({ r, houses }: { r: Rect; houses: number }) {
  const b = bandRect(r)
  const hotel = houses >= 5
  const n = hotel ? 1 : houses
  const items = Array.from({ length: n })
  const horizontal = r.band === 'top' || r.band === 'bottom'
  const size = 15
  const gap = 5
  const total = n * size + (n - 1) * gap
  return (
    <>
      {items.map((_, i) => {
        const cx = horizontal ? b.x + b.w / 2 - total / 2 + i * (size + gap) + size / 2 : b.x + b.w / 2
        const cy = horizontal ? b.y + b.h / 2 : b.y + b.h / 2 - total / 2 + i * (size + gap) + size / 2
        return (
          <rect key={i} x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx="3"
            fill={hotel ? '#d9433a' : '#3fae5a'} stroke="#fff" strokeWidth="2" />
        )
      })}
    </>
  )
}
