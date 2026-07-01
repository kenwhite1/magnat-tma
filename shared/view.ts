// Проекция состояния под конкретного игрока: то, что рисует клиент, и то, что
// сервер отдаёт каждому онлайн-участнику. В «Магнате» почти всё публично
// (позиции, деньги, владения), поэтому вид полный, но с удобными флагами.

import { type GameState, netWorth, buildableTiles, currentPlayer, canBuild } from './engine'
import { monopolyCount } from './bots'
import { tileAt } from './board'
import type { DeckCard } from './deck'

export interface PublicPlayer {
  id: string
  name: string
  isBot: boolean
  color: string
  pos: number
  cash: number
  inJail: boolean
  bankrupt: boolean
  getOut: number
  netWorth: number
  monopolies: number
  isWinner: boolean
}

export interface GameView {
  youId: string
  players: PublicPlayer[]
  owners: Record<number, string>
  houses: Record<number, number>
  mortgaged: Record<number, boolean>
  turn: number // индекс текущего игрока
  phase: 'roll' | 'buy'
  dice: [number, number] | null
  doubles: number
  moved: boolean
  status: 'playing' | 'finished'
  winnerId: string | null
  round: number

  yourTurn: boolean
  canRoll: boolean
  youInJail: boolean
  pendingTile: number | null
  canBuyPending: boolean
  buildableIds: number[]
  drawn: { deck: 'chance' | 'chest'; card: DeckCard } | null
  log: string[]
}

export function toView(s: GameState, youId: string): GameView {
  const cur = currentPlayer(s)
  const yourTurn = s.status === 'playing' && cur?.id === youId
  const me = s.players.find(p => p.id === youId)
  const canBuyPending =
    s.phase === 'buy' &&
    s.pendingTile != null &&
    !!me &&
    me.cash >= (tileAt(s.pendingTile).price ?? 0)

  return {
    youId,
    players: s.players.map(p => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      color: p.color,
      pos: p.pos,
      cash: p.cash,
      inJail: p.inJail,
      bankrupt: p.bankrupt,
      getOut: p.getOut,
      netWorth: netWorth(s, p.id),
      monopolies: monopolyCount(s, p.id),
      isWinner: s.winnerId === p.id,
    })),
    owners: { ...s.owners },
    houses: { ...s.houses },
    mortgaged: { ...s.mortgaged },
    turn: s.turn,
    phase: s.phase,
    dice: s.dice ? [s.dice[0], s.dice[1]] : null,
    doubles: s.doubles,
    moved: s.moved,
    status: s.status,
    winnerId: s.winnerId,
    round: s.round,

    yourTurn,
    canRoll: yourTurn && s.phase === 'roll' && !!me && !me.inJail,
    youInJail: !!me && me.inJail,
    pendingTile: s.phase === 'buy' ? s.pendingTile : null,
    canBuyPending,
    buildableIds: yourTurn && s.phase === 'roll' && me ? buildableTiles(s, youId) : [],
    drawn: s.drawn,
    log: s.log.slice(-6).map(l => l.text),
  }
}

// Реэкспорт для мест, где нужен только предикат постройки.
export { canBuild }
