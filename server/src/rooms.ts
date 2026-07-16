// --- Менеджер онлайн-комнат --------------------------------------------------
// Авторитетные партии живут в памяти (один инстанс на Railway). Соло-игра
// полностью на клиенте и сервера не требует; комнаты добавляют социальный слой
// «играть с друзьями».
//
// Две разновидности комнат:
//   * комнаты с друзьями — по коду, пустые места добиваются (видимыми) ботами
//   * быстрые комнаты     — публичный подбор; автостарт и добивка ботами,
//                           которых клиент видит как обычных игроков

import { createGame, applyAction, currentPlayer, finalScore, type GameState, type Action } from '../../shared/engine'
import { botDecide, type Difficulty } from '../../shared/bots'
import { toView } from '../../shared/view'
import type { RoomStateDto, RoomDto } from '../../shared/types'
import { ownsGroup } from '../../shared/engine'
import { GROUPS, groupTiles, MAX_HOUSES, type Group } from '../../shared/board'
import { recordResult } from './profiles'
import { reportMatch } from './gg'
import type { MatchMode } from '../../shared/gg'

// «Монополист»: победитель держит полный цветной набор, застроенный отелями.
// Вокзалы и предприятия не считаем — на них не строят (houseCost 0).
function hasHotelMonopoly(g: GameState, playerId: string): boolean {
  return (Object.keys(GROUPS) as Group[]).some(
    grp =>
      GROUPS[grp].houseCost > 0 &&
      ownsGroup(g, playerId, grp) &&
      groupTiles(grp).every(id => (g.houses[id] ?? 0) >= MAX_HOUSES),
  )
}

interface Seat {
  id: string // id в движке: 'u<tgid>' для людей, 'bot1'... для ботов
  tgId: number | null
  name: string
  isBot: boolean
  isHost: boolean
  lastSeen: number
  difficulty: Difficulty
}

interface Room {
  code: string
  hostTgId: number
  seats: Seat[]
  game: GameState | null
  version: number
  maxPlayers: number
  createdAt: number
  lastActivity: number
  scored: boolean
  roundOver: { winnerName: string; score: number } | null
  quick: boolean
  startTimer: ReturnType<typeof setTimeout> | null
}

const rooms = new Map<string, Room>()
const MAX = 4
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // без легко путаемых символов
const QUICK_DELAY = 6000 // окно подбора перед автостартом быстрой комнаты

const BOT_NAMES = ['Аня', 'Боря', 'Витя', 'Галя', 'Дина', 'Жора']
const HUMAN_NAMES = [
  'Максим', 'Лена', 'Дима', 'Соня', 'Костя', 'Вера', 'Паша', 'Юля',
  'Олег', 'Катя', 'Рома', 'Настя', 'Игорь', 'Маша', 'Артём', 'Поля',
]

function newCode(): string {
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  } while (rooms.has(code))
  return code
}

function seatFor(room: Room, tgId: number): Seat | undefined {
  return room.seats.find(s => s.tgId === tgId)
}

function pickQuickDiff(): Difficulty {
  const r = Math.random()
  return r < 0.25 ? 'easy' : r < 0.8 ? 'medium' : 'hard'
}

// Добить стол ботами. В быстрых комнатах — человеческие имена и разная
// сложность, чтобы соперники читались как живые; в дружеских — обычные боты.
function fillBots(room: Room): void {
  const used = new Set(room.seats.map(s => s.name))
  const pool = room.quick ? HUMAN_NAMES : BOT_NAMES
  let b = room.seats.filter(s => s.isBot).length + 1
  let pi = Math.floor(Math.random() * pool.length)
  while (room.seats.length < room.maxPlayers) {
    let name = pool[pi % pool.length]
    let tries = 0
    while (used.has(name) && tries++ < pool.length) name = pool[++pi % pool.length]
    used.add(name)
    room.seats.push({
      id: `bot${b++}`,
      tgId: null,
      name,
      isBot: true,
      isHost: false,
      lastSeen: Date.now(),
      difficulty: room.quick ? pickQuickDiff() : 'medium',
    })
  }
}

function beginGame(room: Room): void {
  if (room.startTimer) { clearTimeout(room.startTimer); room.startTimer = null }
  fillBots(room)
  const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
  room.game = createGame({
    players: room.seats.map(s => ({ id: s.id, name: s.name, isBot: s.isBot })),
    seed,
  })
  room.scored = false
  room.roundOver = null
  room.version++
  room.lastActivity = Date.now()
  runBots(room)
}

function roomDto(room: Room): RoomDto {
  return {
    code: room.code,
    hostId: room.quick ? '' : `u${room.hostTgId}`,
    started: !!room.game,
    maxPlayers: room.maxPlayers,
    quick: room.quick,
    players: room.seats.map(s => ({
      id: s.id,
      name: s.name,
      // быстрые комнаты никогда не раскрывают, что место занял бот
      isBot: room.quick ? false : s.isBot,
      isHost: room.quick ? false : s.isHost,
      connected: s.isBot || Date.now() - s.lastSeen < 15000,
    })),
  }
}

export function createRoom(tgId: number, name: string): RoomStateDto {
  const code = newCode()
  const room: Room = {
    code,
    hostTgId: tgId,
    seats: [{ id: `u${tgId}`, tgId, name, isBot: false, isHost: true, lastSeen: Date.now(), difficulty: 'medium' }],
    game: null,
    version: 1,
    maxPlayers: MAX,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    scored: false,
    roundOver: null,
    quick: false,
    startTimer: null,
  }
  rooms.set(code, room)
  return stateFor(room, tgId)
}

export function joinRoom(code: string, tgId: number, name: string): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  if (room.game) return { error: 'already_started' }
  const existing = seatFor(room, tgId)
  if (existing) {
    existing.lastSeen = Date.now()
    return stateFor(room, tgId)
  }
  const humans = room.seats.filter(s => !s.isBot).length
  if (humans >= room.maxPlayers) return { error: 'full' }
  room.seats.push({ id: `u${tgId}`, tgId, name, isBot: false, isHost: false, lastSeen: Date.now(), difficulty: 'medium' })
  room.version++
  room.lastActivity = Date.now()
  return stateFor(room, tgId)
}

// Публичный подбор: сесть в открытую быструю комнату или создать свежую,
// которая стартует после короткого окна (добитая замаскированными ботами).
export function quickMatch(tgId: number, name: string): RoomStateDto {
  for (const room of rooms.values()) {
    if (!room.quick || room.game) continue
    if (seatFor(room, tgId)) { room.seats.find(s => s.tgId === tgId)!.lastSeen = Date.now(); return stateFor(room, tgId) }
    const humans = room.seats.filter(s => !s.isBot).length
    if (humans >= room.maxPlayers) continue
    room.seats.push({ id: `u${tgId}`, tgId, name, isBot: false, isHost: false, lastSeen: Date.now(), difficulty: 'medium' })
    room.version++
    room.lastActivity = Date.now()
    if (room.seats.filter(s => !s.isBot).length >= room.maxPlayers) beginGame(room)
    return stateFor(room, tgId)
  }
  const code = newCode()
  const room: Room = {
    code,
    hostTgId: tgId,
    seats: [{ id: `u${tgId}`, tgId, name, isBot: false, isHost: true, lastSeen: Date.now(), difficulty: 'medium' }],
    game: null,
    version: 1,
    maxPlayers: MAX,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    scored: false,
    roundOver: null,
    quick: true,
    startTimer: null,
  }
  rooms.set(code, room)
  room.startTimer = setTimeout(() => {
    const r = rooms.get(code)
    if (r && !r.game) beginGame(r)
  }, QUICK_DELAY)
  return stateFor(room, tgId)
}

export function startRoom(code: string, tgId: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  if (room.hostTgId !== tgId) return { error: 'not_host' }
  if (room.game) return { error: 'already_started' }
  beginGame(room)
  return stateFor(room, tgId)
}

export function actInRoom(code: string, tgId: number, action: Action): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room || !room.game) return { error: 'no_game' }
  const seat = seatFor(room, tgId)
  if (!seat) return { error: 'not_in_room' }
  // человек может действовать только за своё место
  if (action.playerId !== seat.id) return { error: 'not_your_seat' }
  seat.lastSeen = Date.now()

  const res = applyAction(room.game, action)
  if (res.error) return { error: res.error }
  room.game = res.state
  room.version++
  room.lastActivity = Date.now()
  runBots(room)
  finishIfDone(room)
  return stateFor(room, tgId)
}

// Проиграть все подряд ходы ботов, пока не наступит ход человека или конец партии.
function runBots(room: Room): void {
  let guard = 0
  while (room.game && room.game.status === 'playing' && guard++ < 2000) {
    const cur = currentPlayer(room.game)
    const seat = room.seats.find(s => s.id === cur.id)
    if (!seat || !seat.isBot) break
    const res = applyAction(room.game, botDecide(room.game, cur.id, seat.difficulty))
    if (res.error) break
    room.game = res.state
    room.version++
  }
  finishIfDone(room)
}

function finishIfDone(room: Room): void {
  if (!room.game || room.game.status !== 'finished' || room.scored) return
  room.scored = true
  const winner = room.game.players.find(p => p.id === room.game!.winnerId)
  const score = finalScore(room.game)
  room.roundOver = { winnerName: winner?.name ?? '-', score }
  const g = room.game
  // Живые — только настоящие люди: в быстрой комнате боты замаскированы под них
  // для UI, но хабу нужно честное число (соц./ранговые ачивки, анти-чит).
  const humans = room.seats.filter(h => !h.isBot && h.tgId != null)
  const mode: MatchMode = room.quick ? 'multi' : 'friends'
  for (const s of room.seats) {
    if (s.isBot || s.tgId == null) continue
    const won = g.winnerId === s.id
    recordResult(s.tgId, 'online', won, won ? score : 0)
    // Рапорт хабу: room.scored выше гарантирует один раз на партию, а ключ
    // идемпотентности (код + время создания комнаты) — что повтор не доплатит.
    // «Без потерь» не шлём: фигур, которые можно потерять, в «Магнате» нет.
    const stats: Record<string, boolean> = {}
    if (won && g.turnCount < 25) stats.fast = true
    if (won && hasHotelMonopoly(g, s.id)) stats.signature = true
    reportMatch({
      userId: s.tgId,
      idempotencyKey: `magnat-${room.code}-${room.createdAt}-${s.tgId}`,
      won,
      players: room.seats.length,
      humanPlayers: humans.length,
      score: won ? score : 0,
      mode,
      opponents: humans.filter(h => h.tgId !== s.tgId).map(h => h.tgId as number),
      stats: Object.keys(stats).length ? stats : undefined,
    })
  }
}

export function getRoomState(code: string, tgId: number): RoomStateDto | { error: string } {
  const room = rooms.get(code.toUpperCase())
  if (!room) return { error: 'no_room' }
  const seat = seatFor(room, tgId)
  if (seat) seat.lastSeen = Date.now()
  return stateFor(room, tgId)
}

export function leaveRoom(code: string, tgId: number): void {
  const room = rooms.get(code.toUpperCase())
  if (!room) return
  if (!room.game) {
    room.seats = room.seats.filter(s => s.tgId !== tgId)
    if (room.seats.filter(s => !s.isBot).length === 0) {
      if (room.startTimer) clearTimeout(room.startTimer)
      rooms.delete(code.toUpperCase())
    } else room.version++
  }
}

function stateFor(room: Room, tgId: number): RoomStateDto {
  const seat = seatFor(room, tgId)
  let view = room.game && seat ? toView(room.game, seat.id) : null
  if (view && room.quick) view = { ...view, players: view.players.map(p => ({ ...p, isBot: false })) }
  return {
    room: roomDto(room),
    version: room.version,
    view,
    roundOver: room.roundOver,
  }
}

// подметаем простаивающие комнаты каждые 10 мин (30 мин простоя = удаление)
setInterval(() => {
  const now = Date.now()
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > 30 * 60_000) {
      if (room.startTimer) clearTimeout(room.startTimer)
      rooms.delete(code)
    }
  }
}, 10 * 60_000).unref?.()
