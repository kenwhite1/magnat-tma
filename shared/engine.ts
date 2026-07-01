// --- Движок «Магнат» ---------------------------------------------------------
// Детерминированный, сериализуемый движок настольной игры про недвижимость.
// Одна и та же последовательность действий и один и тот же seed дают одинаковый
// результат на сервере (авторитетный онлайн) и на клиенте (мгновенная соло-игра).
//
// Поток хода строится вокруг небольшого конечного автомата `phase`:
//   'roll'  — игрок строит дома (по желанию) и бросает кубики; в тюрьме тут
//             доступны «выйти» и «бросок на дубль»
//   'buy'   — игрок встал на ничью недвижимость и решает, покупать ли
// Все прочие исходы (аренда, налог, карта, тюрьма) применяются автоматически.
// Долги гасятся авто-ликвидацией (продажа домов, залог), а не ручным микроменеджментом.

import { makeRng, type Rng } from './rng'
import {
  BOARD,
  BOARD_SIZE,
  JAIL_INDEX,
  GO_SALARY,
  JAIL_FINE,
  RAIL_RENT,
  UTIL_MULT,
  MAX_HOUSES,
  MAX_ROUNDS,
  START_CASH,
  tileAt,
  groupTiles,
  type Group,
} from './board'
import { CHANCE, CHEST, type DeckCard } from './deck'

const TOKEN_COLORS = ['#e05a4d', '#3d8be0', '#54b15a', '#f0b429']

export interface Player {
  id: string
  name: string
  isBot: boolean
  color: string
  pos: number
  cash: number
  inJail: boolean
  jailTurns: number
  bankrupt: boolean
  getOut: number // карт «выйти из тюрьмы бесплатно»
}

export type Phase = 'roll' | 'buy'

export interface GameState {
  players: Player[]
  turn: number // индекс текущего игрока
  phase: Phase
  dice: [number, number] | null
  doubles: number // сколько дублей подряд в этом ходу
  moved: boolean // игрок уже двигался в этом под-ходе (для показа)
  owners: Record<number, string> // tileId -> playerId
  houses: Record<number, number> // tileId -> число домов (0..5)
  mortgaged: Record<number, boolean> // tileId -> в залоге
  pendingTile: number | null // клетка, ожидающая решения о покупке
  drawn: { deck: 'chance' | 'chest'; card: DeckCard } | null // последняя карта (для показа)
  chanceOrder: number[]
  chestOrder: number[]
  chancePtr: number
  chestPtr: number
  status: 'playing' | 'finished'
  winnerId: string | null
  rngState: number
  turnCount: number
  round: number
  log: { text: string }[]
}

export type Action =
  | { type: 'roll'; playerId: string }
  | { type: 'buy'; playerId: string }
  | { type: 'decline'; playerId: string }
  | { type: 'build'; playerId: string; tileId: number }
  | { type: 'jailPay'; playerId: string }
  | { type: 'jailRoll'; playerId: string }

export type GameEvent =
  | { kind: 'roll'; a: number; b: number; doubles: boolean }
  | { kind: 'move'; playerId: string; to: number }
  | { kind: 'passGo'; playerId: string; amount: number }
  | { kind: 'buy'; playerId: string; tileId: number }
  | { kind: 'rent'; from: string; to: string; amount: number; tileId: number }
  | { kind: 'tax'; playerId: string; amount: number }
  | { kind: 'card'; deck: 'chance' | 'chest'; text: string }
  | { kind: 'money'; playerId: string; amount: number }
  | { kind: 'jail'; playerId: string }
  | { kind: 'freed'; playerId: string }
  | { kind: 'build'; playerId: string; tileId: number; houses: number }
  | { kind: 'bankrupt'; playerId: string }
  | { kind: 'win'; playerId: string }

export interface ActionResult {
  state: GameState
  events: GameEvent[]
  error?: string
}

// -- создание игры -----------------------------------------------------------
export function createGame(opts: {
  players: { id: string; name: string; isBot: boolean }[]
  seed: number
}): GameState {
  const rng = makeRng(opts.seed)
  const players: Player[] = opts.players.map((p, i) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    color: TOKEN_COLORS[i % TOKEN_COLORS.length],
    pos: 0,
    cash: START_CASH,
    inJail: false,
    jailTurns: 0,
    bankrupt: false,
    getOut: 0,
  }))
  const chanceOrder = shuffledIndices(CHANCE.length, rng)
  const chestOrder = shuffledIndices(CHEST.length, rng)
  return {
    players,
    turn: 0,
    phase: 'roll',
    dice: null,
    doubles: 0,
    moved: false,
    owners: {},
    houses: {},
    mortgaged: {},
    pendingTile: null,
    drawn: null,
    chanceOrder,
    chestOrder,
    chancePtr: 0,
    chestPtr: 0,
    status: 'playing',
    winnerId: null,
    rngState: rng.state,
    turnCount: 0,
    round: 0,
    log: [{ text: 'Игра началась. Удачи!' }],
  }
}

function shuffledIndices(n: number, rng: Rng): number[] {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// -- клонирование (новые ссылки для React) -----------------------------------
function clone(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map(p => ({ ...p })),
    dice: s.dice ? [s.dice[0], s.dice[1]] : null,
    owners: { ...s.owners },
    houses: { ...s.houses },
    mortgaged: { ...s.mortgaged },
    chanceOrder: s.chanceOrder.slice(),
    chestOrder: s.chestOrder.slice(),
    log: s.log.slice(),
  }
}

// -- геттеры -----------------------------------------------------------------
export function currentPlayer(s: GameState): Player {
  return s.players[s.turn]
}

export function playerById(s: GameState, id: string): Player | undefined {
  return s.players.find(p => p.id === id)
}

export function ownsGroup(s: GameState, playerId: string, group: Group): boolean {
  return groupTiles(group).every(id => s.owners[id] === playerId)
}

function railsOwned(s: GameState, playerId: string): number {
  return groupTiles('rail').filter(id => s.owners[id] === playerId && !s.mortgaged[id]).length
}

function utilsOwned(s: GameState, playerId: string): number {
  return groupTiles('util').filter(id => s.owners[id] === playerId && !s.mortgaged[id]).length
}

// Аренда за клетку с учётом монополии, домов, числа вокзалов/предприятий.
export function rentFor(s: GameState, tileId: number, diceSum: number): number {
  const owner = s.owners[tileId]
  if (owner == null || s.mortgaged[tileId]) return 0
  const tile = tileAt(tileId)
  if (tile.type === 'prop') {
    const h = s.houses[tileId] ?? 0
    const base = tile.rent![h]
    if (h === 0 && ownsGroup(s, owner, tile.group!)) return base * 2
    return base
  }
  if (tile.type === 'rail') {
    const n = railsOwned(s, owner)
    return RAIL_RENT[Math.max(0, n - 1)] ?? 0
  }
  if (tile.type === 'util') {
    const n = utilsOwned(s, owner)
    return diceSum * (UTIL_MULT[Math.max(0, n - 1)] ?? 0)
  }
  return 0
}

// Полная стоимость игрока: наличные + недвижимость + дома.
export function netWorth(s: GameState, playerId: string): number {
  const p = playerById(s, playerId)
  if (!p) return 0
  let total = p.cash
  for (const t of BOARD) {
    if (s.owners[t.id] !== playerId) continue
    total += s.mortgaged[t.id] ? Math.floor((t.price ?? 0) / 2) : t.price ?? 0
    total += (s.houses[t.id] ?? 0) * (t.houseCost ?? 0)
  }
  return total
}

// Можно ли построить дом на этой клетке прямо сейчас?
export function canBuild(s: GameState, playerId: string, tileId: number): boolean {
  const tile = tileAt(tileId)
  if (tile.type !== 'prop') return false
  if (s.owners[tileId] !== playerId) return false
  if (!ownsGroup(s, playerId, tile.group!)) return false
  const group = groupTiles(tile.group!)
  if (group.some(id => s.mortgaged[id])) return false
  const h = s.houses[tileId] ?? 0
  if (h >= MAX_HOUSES) return false
  // равномерная застройка: нельзя уходить в отрыв больше чем на 1 дом
  const minInGroup = Math.min(...group.map(id => s.houses[id] ?? 0))
  if (h > minInGroup) return false
  const p = playerById(s, playerId)!
  if (p.cash < (tile.houseCost ?? 0)) return false
  return true
}

// Индексы, на которых игрок может построить (для подсказок ботам и UI).
export function buildableTiles(s: GameState, playerId: string): number[] {
  return BOARD.filter(t => t.type === 'prop' && canBuild(s, playerId, t.id)).map(t => t.id)
}

// -- главная функция ---------------------------------------------------------
export function applyAction(prev: GameState, action: Action): ActionResult {
  if (prev.status !== 'playing') return { state: prev, events: [], error: 'finished' }
  const s = clone(prev)
  const events: GameEvent[] = []
  const cur = currentPlayer(s)
  if (action.playerId !== cur.id) return { state: prev, events: [], error: 'not_your_turn' }

  switch (action.type) {
    case 'build': {
      if (s.phase !== 'roll') return { state: prev, events: [], error: 'bad_phase' }
      if (!canBuild(s, cur.id, action.tileId)) return { state: prev, events: [], error: 'cant_build' }
      const tile = tileAt(action.tileId)
      cur.cash -= tile.houseCost ?? 0
      s.houses[action.tileId] = (s.houses[action.tileId] ?? 0) + 1
      events.push({ kind: 'build', playerId: cur.id, tileId: action.tileId, houses: s.houses[action.tileId] })
      logLine(s, `${cur.name} строит на «${tile.name}» (${houseWord(s.houses[action.tileId])})`)
      return { state: s, events }
    }

    case 'buy': {
      if (s.phase !== 'buy' || s.pendingTile == null) return { state: prev, events: [], error: 'bad_phase' }
      const tile = tileAt(s.pendingTile)
      if (s.owners[tile.id] != null) return { state: prev, events: [], error: 'owned' }
      if (cur.cash < (tile.price ?? 0)) return { state: prev, events: [], error: 'no_cash' }
      cur.cash -= tile.price ?? 0
      s.owners[tile.id] = cur.id
      events.push({ kind: 'buy', playerId: cur.id, tileId: tile.id })
      logLine(s, `${cur.name} покупает «${tile.name}» за ${money(tile.price ?? 0)}`)
      s.pendingTile = null
      concludeTurn(s, events)
      return { state: s, events }
    }

    case 'decline': {
      if (s.phase !== 'buy') return { state: prev, events: [], error: 'bad_phase' }
      s.pendingTile = null
      concludeTurn(s, events)
      return { state: s, events }
    }

    case 'jailPay': {
      if (s.phase !== 'roll' || !cur.inJail) return { state: prev, events: [], error: 'bad_phase' }
      if (cur.getOut > 0) {
        cur.getOut--
        logLine(s, `${cur.name} выходит из тюрьмы по карте`)
      } else {
        settle(s, cur, JAIL_FINE, null, events)
        logLine(s, `${cur.name} платит залог ${money(JAIL_FINE)} и выходит`)
      }
      cur.inJail = false
      cur.jailTurns = 0
      events.push({ kind: 'freed', playerId: cur.id })
      // остаётся фаза 'roll' — теперь игрок бросает как обычно
      return { state: s, events }
    }

    case 'jailRoll': {
      if (s.phase !== 'roll' || !cur.inJail) return { state: prev, events: [], error: 'bad_phase' }
      const rng = makeRng(s.rngState)
      const a = 1 + Math.floor(rng.next() * 6)
      const b = 1 + Math.floor(rng.next() * 6)
      s.rngState = rng.state
      s.dice = [a, b]
      s.moved = false
      events.push({ kind: 'roll', a, b, doubles: a === b })
      if (a === b) {
        cur.inJail = false
        cur.jailTurns = 0
        events.push({ kind: 'freed', playerId: cur.id })
        logLine(s, `${cur.name} выбрасывает дубль и выходит из тюрьмы`)
        const pending = advanceAndResolve(s, cur, a + b, events)
        // выход по дублю НЕ даёт повторный бросок
        if (!pending) concludeTurn(s, events)
      } else {
        cur.jailTurns++
        if (cur.jailTurns >= 3) {
          if (cur.getOut > 0) cur.getOut--
          else settle(s, cur, JAIL_FINE, null, events)
          cur.inJail = false
          cur.jailTurns = 0
          events.push({ kind: 'freed', playerId: cur.id })
          logLine(s, `${cur.name} отсидел срок, выходит и ходит на ${a + b}`)
          const pending = advanceAndResolve(s, cur, a + b, events)
          if (!pending) concludeTurn(s, events)
        } else {
          logLine(s, `${cur.name} не выбросил дубль (${cur.jailTurns}/3)`)
          concludeTurn(s, events)
        }
      }
      return { state: s, events }
    }

    case 'roll': {
      if (s.phase !== 'roll') return { state: prev, events: [], error: 'bad_phase' }
      if (cur.inJail) return { state: prev, events: [], error: 'in_jail' }
      const rng = makeRng(s.rngState)
      const a = 1 + Math.floor(rng.next() * 6)
      const b = 1 + Math.floor(rng.next() * 6)
      s.rngState = rng.state
      s.dice = [a, b]
      s.moved = false
      const isDouble = a === b
      events.push({ kind: 'roll', a, b, doubles: isDouble })
      if (isDouble) {
        s.doubles++
        if (s.doubles >= 3) {
          logLine(s, `${cur.name} выбросил третий дубль подряд и едет на нары`)
          sendToJail(s, cur, events)
          concludeTurn(s, events)
          return { state: s, events }
        }
      }
      const pending = advanceAndResolve(s, cur, a + b, events)
      if (!pending) concludeTurn(s, events)
      return { state: s, events }
    }
  }
}

// -- движение и разбор клетки -------------------------------------------------
// Возвращает true, если после движения ждём решения о покупке (фаза 'buy').
function advanceAndResolve(s: GameState, p: Player, steps: number, events: GameEvent[]): boolean {
  stepForward(s, p, steps, events)
  return resolveLanding(s, p, steps, events)
}

function stepForward(s: GameState, p: Player, steps: number, events: GameEvent[]): void {
  const np = p.pos + steps
  if (np >= BOARD_SIZE) {
    p.cash += GO_SALARY
    events.push({ kind: 'passGo', playerId: p.id, amount: GO_SALARY })
  }
  p.pos = ((np % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE
  s.moved = true
  events.push({ kind: 'move', playerId: p.id, to: p.pos })
}

function sendToIndex(s: GameState, p: Player, target: number, events: GameEvent[]): void {
  const steps = (((target - p.pos) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE
  if (steps === 0) return
  stepForward(s, p, steps, events)
}

// Возвращает true, если ждём решения о покупке (фаза 'buy').
function resolveLanding(s: GameState, p: Player, diceSum: number, events: GameEvent[]): boolean {
  const tile = tileAt(p.pos)
  switch (tile.type) {
    case 'go':
    case 'jail':
    case 'parking':
      return false
    case 'gojail':
      logLine(s, `${p.name} отправляется на нары`)
      sendToJail(s, p, events)
      return false
    case 'tax':
      settle(s, p, tile.tax ?? 0, null, events)
      events.push({ kind: 'tax', playerId: p.id, amount: tile.tax ?? 0 })
      logLine(s, `${p.name} платит налог ${money(tile.tax ?? 0)}`)
      return false
    case 'chance':
      return applyCard(s, p, 'chance', diceSum, events)
    case 'chest':
      return applyCard(s, p, 'chest', diceSum, events)
    case 'prop':
    case 'rail':
    case 'util': {
      const owner = s.owners[tile.id]
      if (owner == null) {
        s.pendingTile = tile.id
        s.phase = 'buy'
        return true
      }
      if (owner === p.id) return false
      const ownerP = playerById(s, owner)
      if (!ownerP || ownerP.bankrupt) return false
      if (s.mortgaged[tile.id]) return false
      const rent = rentFor(s, tile.id, diceSum)
      settle(s, p, rent, ownerP, events)
      events.push({ kind: 'rent', from: p.id, to: owner, amount: rent, tileId: tile.id })
      logLine(s, `${p.name} платит аренду ${money(rent)} игроку ${ownerP.name}`)
      return false
    }
  }
}

function applyCard(
  s: GameState,
  p: Player,
  deck: 'chance' | 'chest',
  diceSum: number,
  events: GameEvent[],
): boolean {
  const list = deck === 'chance' ? CHANCE : CHEST
  const order = deck === 'chance' ? s.chanceOrder : s.chestOrder
  const ptr = deck === 'chance' ? s.chancePtr : s.chestPtr
  const card: DeckCard = list[order[ptr % order.length]]
  if (deck === 'chance') s.chancePtr = (ptr + 1) % order.length
  else s.chestPtr = (ptr + 1) % order.length
  s.drawn = { deck, card }
  events.push({ kind: 'card', deck, text: card.text })
  logLine(s, `${deck === 'chance' ? 'Шанс' : 'Казна'}: ${card.text}`)

  const e = card.effect
  switch (e.kind) {
    case 'money':
      if (e.amount >= 0) p.cash += e.amount
      else settle(s, p, -e.amount, null, events)
      events.push({ kind: 'money', playerId: p.id, amount: e.amount })
      return false
    case 'collect': {
      let got = 0
      for (const other of s.players) {
        if (other.id === p.id || other.bankrupt) continue
        settle(s, other, e.amount, p, events)
        got += e.amount
      }
      events.push({ kind: 'money', playerId: p.id, amount: got })
      return false
    }
    case 'pay': {
      const rivals = s.players.filter(x => !x.bankrupt && x.id !== p.id)
      for (const other of rivals) settle(s, p, e.amount, other, events)
      events.push({ kind: 'money', playerId: p.id, amount: -e.amount * rivals.length })
      return false
    }
    case 'move':
      sendToIndex(s, p, e.to, events)
      return resolveLanding(s, p, diceSum, events)
    case 'moveBack':
      p.pos = (((p.pos - e.steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE
      events.push({ kind: 'move', playerId: p.id, to: p.pos })
      return resolveLanding(s, p, diceSum, events)
    case 'gojail':
      sendToJail(s, p, events)
      return false
    case 'getout':
      p.getOut++
      return false
  }
}

function sendToJail(s: GameState, p: Player, events: GameEvent[]): void {
  p.pos = JAIL_INDEX
  p.inJail = true
  p.jailTurns = 0
  s.doubles = 0
  events.push({ kind: 'jail', playerId: p.id })
}

// -- деньги и банкротство -----------------------------------------------------
// Списывает сумму с должника; при нехватке — авто-ликвидация (снос домов за
// полцены, залог). Если и этого мало — банкротство: активы переходят кредитору
// (или банку), должник выбывает.
function settle(
  s: GameState,
  debtor: Player,
  amount: number,
  creditor: Player | null,
  events: GameEvent[],
): void {
  if (amount <= 0) return
  if (debtor.cash < amount) liquidate(s, debtor, amount)
  if (debtor.cash >= amount) {
    debtor.cash -= amount
    if (creditor) creditor.cash += amount
    return
  }
  // банкротство
  const remaining = Math.max(0, debtor.cash)
  debtor.cash = 0
  if (creditor) creditor.cash += remaining
  transferOrRelease(s, debtor, creditor)
  debtor.bankrupt = true
  events.push({ kind: 'bankrupt', playerId: debtor.id })
  logLine(s, `${debtor.name} обанкротился${creditor ? ` в пользу ${creditor.name}` : ''}`)
}

function liquidate(s: GameState, p: Player, need: number): void {
  // 1) продать дома за полцены, начиная с самых застроенных
  const withHouses = BOARD.filter(t => s.owners[t.id] === p.id && (s.houses[t.id] ?? 0) > 0).sort(
    (a, b) => (s.houses[b.id] ?? 0) - (s.houses[a.id] ?? 0),
  )
  for (const t of withHouses) {
    while ((s.houses[t.id] ?? 0) > 0 && p.cash < need) {
      s.houses[t.id] = (s.houses[t.id] ?? 0) - 1
      p.cash += Math.floor((t.houseCost ?? 0) / 2)
    }
    if (p.cash >= need) return
  }
  // 2) заложить недвижимость за полцены
  for (const t of BOARD) {
    if (p.cash >= need) return
    if (s.owners[t.id] !== p.id || s.mortgaged[t.id]) continue
    if ((s.houses[t.id] ?? 0) > 0) continue
    s.mortgaged[t.id] = true
    p.cash += Math.floor((t.price ?? 0) / 2)
  }
}

function transferOrRelease(s: GameState, debtor: Player, creditor: Player | null): void {
  for (const t of BOARD) {
    if (s.owners[t.id] !== debtor.id) continue
    delete s.houses[t.id]
    if (creditor) {
      s.owners[t.id] = creditor.id
      // залог сохраняется у нового владельца
    } else {
      delete s.owners[t.id]
      delete s.mortgaged[t.id]
    }
  }
}

// -- завершение хода ----------------------------------------------------------
function concludeTurn(s: GameState, events: GameEvent[]): void {
  if (checkWin(s, events)) return
  const cur = currentPlayer(s)
  const rolledDouble = s.dice && s.dice[0] === s.dice[1]
  // повторный ход за дубль (но не из тюрьмы и не после банкротства)
  if (rolledDouble && !cur.inJail && !cur.bankrupt && s.doubles > 0 && s.doubles < 3) {
    s.phase = 'roll'
    s.pendingTile = null
    s.moved = false
    return
  }
  // передать ход следующему платёжеспособному игроку
  s.doubles = 0
  s.phase = 'roll'
  s.pendingTile = null
  s.moved = false
  s.turnCount++
  advanceTurn(s)
  if (s.round >= MAX_ROUNDS) {
    finishByWealth(s, events)
    return
  }
  checkWin(s, events)
}

function advanceTurn(s: GameState): void {
  const n = s.players.length
  for (let i = 1; i <= n; i++) {
    const idx = (s.turn + i) % n
    if (!s.players[idx].bankrupt) {
      if (idx <= s.turn) s.round++ // прошли круг
      s.turn = idx
      return
    }
  }
}

function checkWin(s: GameState, events: GameEvent[]): boolean {
  const alive = s.players.filter(p => !p.bankrupt)
  if (alive.length <= 1) {
    s.status = 'finished'
    s.winnerId = alive[0]?.id ?? null
    if (s.winnerId) events.push({ kind: 'win', playerId: s.winnerId })
    logLine(s, alive[0] ? `${alive[0].name} побеждает, последний платёжеспособный магнат!` : 'Партия окончена')
    return true
  }
  return false
}

function finishByWealth(s: GameState, events: GameEvent[]): void {
  const alive = s.players.filter(p => !p.bankrupt)
  let best = alive[0]
  for (const p of alive) if (netWorth(s, p.id) > netWorth(s, best.id)) best = p
  s.status = 'finished'
  s.winnerId = best.id
  events.push({ kind: 'win', playerId: best.id })
  logLine(s, `Достигнут предел раундов. Богатейший магнат: ${best.name}!`)
}

// -- журнал и форматирование --------------------------------------------------
function logLine(s: GameState, text: string): void {
  s.log = [...s.log.slice(-9), { text }]
}

export function money(n: number): string {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function houseWord(h: number): string {
  if (h >= MAX_HOUSES) return 'отель'
  return `${h} ${h === 1 ? 'дом' : 'дома'}`
}

// Итоговый «счёт» для профиля: полная стоимость победителя (в сотнях).
export function finalScore(s: GameState): number {
  if (!s.winnerId) return 0
  return Math.round(netWorth(s, s.winnerId) / 100)
}
