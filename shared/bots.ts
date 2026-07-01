// --- Боты «Магнат» ----------------------------------------------------------
// Человекоподобная эвристика. Возвращает РОВНО одно действие для текущего
// под-состояния бота, поэтому драйвер может крутить applyAction(botDecide(...))
// пока ход не вернётся к человеку.
//
// Сложность меняет качество игры:
//   easy   — покупает вяло, почти не строит, в тюрьме просто бросает кубики
//   medium — держит подушку наличных, застраивает монополии
//   hard   — агрессивно скупает и достраивает, бережёт кэш, метит в монополии

import { tileAt, groupTiles, type Group } from './board'
import {
  type Action,
  type GameState,
  currentPlayer,
  buildableTiles,
  ownsGroup,
} from './engine'

export type Difficulty = 'easy' | 'medium' | 'hard'

// Стабильный псевдослучай в [0,1): одна и та же позиция решает одинаково,
// без Math.random в общем коде и без расхода rng движка.
function jitter(s: GameState, salt: number): number {
  let h = (s.turnCount * 2654435761 + s.players[s.turn].pos * 40503 + s.players[s.turn].cash + salt) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  return (h % 1000) / 1000
}

// Докупив эту клетку, бот замкнёт цветную группу?
function completesGroup(s: GameState, botId: string, tileId: number): boolean {
  const tile = tileAt(tileId)
  if (!tile.group || tile.type !== 'prop') return false
  return groupTiles(tile.group).every(id => id === tileId || s.owners[id] === botId)
}

function buffer(diff: Difficulty): number {
  return diff === 'hard' ? 1000 : diff === 'medium' ? 2500 : 1500
}

function wantBuy(s: GameState, botId: string, tileId: number, diff: Difficulty): boolean {
  const me = s.players.find(p => p.id === botId)!
  const price = tileAt(tileId).price ?? 0
  if (me.cash < price) return false
  // замкнуть монополию — почти всегда выгодно
  if (completesGroup(s, botId, tileId)) return me.cash - price >= 0
  const after = me.cash - price
  if (diff === 'hard') return after >= buffer('hard') && jitter(s, 7) > 0.08
  if (diff === 'medium') return after >= buffer('medium')
  return after >= buffer('easy') && jitter(s, 3) > 0.4
}

// Выбор клетки для постройки (или null — не строить сейчас).
function chooseBuild(s: GameState, botId: string, diff: Difficulty): number | null {
  const me = s.players.find(p => p.id === botId)!
  const options = buildableTiles(s, botId)
  if (options.length === 0) return null
  const keep = diff === 'hard' ? 2000 : diff === 'medium' ? 4000 : 8000
  // easy строит редко
  if (diff === 'easy' && jitter(s, 11) < 0.55) return null
  // самый дорогой дом среди доступных (обычно самая ценная группа)
  const best = options
    .map(id => ({ id, cost: tileAt(id).houseCost ?? 0 }))
    .sort((a, b) => b.cost - a.cost)[0]
  if (me.cash - best.cost < keep) return null
  return best.id
}

function jailChoice(s: GameState, botId: string, diff: Difficulty): Action {
  const me = s.players.find(p => p.id === botId)!
  if (me.getOut > 0) return { type: 'jailPay', playerId: botId } // бесплатная карта
  const payFloor = diff === 'hard' ? 2000 : diff === 'medium' ? 3000 : 6000
  if (me.cash >= payFloor && jitter(s, 5) > 0.25) return { type: 'jailPay', playerId: botId }
  return { type: 'jailRoll', playerId: botId }
}

/** Одно действие бота для текущего под-состояния (должен быть ход бота). */
export function botDecide(s: GameState, botId: string, difficulty: Difficulty = 'medium'): Action {
  const me = currentPlayer(s)
  if (me.id !== botId) return { type: 'roll', playerId: botId } // подстраховка

  if (s.phase === 'buy' && s.pendingTile != null) {
    return wantBuy(s, botId, s.pendingTile, difficulty)
      ? { type: 'buy', playerId: botId }
      : { type: 'decline', playerId: botId }
  }

  // фаза 'roll'
  if (me.inJail) return jailChoice(s, botId, difficulty)

  const build = chooseBuild(s, botId, difficulty)
  if (build != null) return { type: 'build', playerId: botId, tileId: build }

  return { type: 'roll', playerId: botId }
}

// Для читаемости в UI: сколько монополий у игрока (шкала силы).
const COLOR_GROUPS: Group[] = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow']
export function monopolyCount(s: GameState, playerId: string): number {
  return COLOR_GROUPS.filter(g => ownsGroup(s, playerId, g)).length
}
