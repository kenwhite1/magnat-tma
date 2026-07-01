import { create } from 'zustand'
import {
  createGame,
  applyAction,
  finalScore,
  money,
  type GameState,
  type Action,
  type GameEvent,
} from '@shared/engine'
import { botDecide, type Difficulty } from '@shared/bots'
import { toView, type GameView } from '@shared/view'
import type { Profile, RoomStateDto } from '@shared/types'
import { api } from './api'
import { haptic, setChrome } from './telegram'
import { playSfx } from './sound'

type Screen = 'home' | 'rules' | 'leaderboard' | 'lobby' | 'game'

interface ResultInfo { won: boolean; score: number; winnerName: string }
interface Reveal { deck: 'chance' | 'chest'; text: string }

interface S {
  ready: boolean
  screen: Screen
  mode: 'solo' | 'online' | null
  profile: Profile | null
  botUsername: string

  solo: GameState | null
  youId: string
  room: RoomStateDto | null
  joinError: string | null
  busy: boolean

  toast: string | null
  fly: { id: number; text: string; tone: 'good' | 'bad' } | null
  rolling: boolean
  reveal: Reveal | null
  buildOpen: boolean
  infoTile: number | null
  result: ResultInfo | null
  difficulty: Difficulty
  difficultyPick: boolean
  leaderboard: { name: string; wins: number; played: number }[]

  // actions
  init(): Promise<void>
  go(s: Screen): void
  startSolo(difficulty?: Difficulty): void
  view(): GameView | null
  roll(): void
  buyProp(): void
  declineProp(): void
  build(tileId: number): void
  jailPay(): void
  jailRoll(): void
  leaveGame(): void
  loadLeaderboard(): Promise<void>
  quickMatch(): Promise<void>
  createRoom(): Promise<void>
  joinRoom(code: string): Promise<void>
  startRoom(): Promise<void>
}

// таймеры вне состояния, чтобы не дёргать ре-рендеры
let botTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let rollTimer: ReturnType<typeof setTimeout> | null = null
let revealTimer: ReturnType<typeof setTimeout> | null = null
let flyId = 0
let prevCash: Record<string, number> = {}

const BOT_DELAY = 780

function clearTimers() {
  if (botTimer) clearTimeout(botTimer)
  botTimer = null
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

export const useStore = create<S>((set, get) => {
  function flash(text: string, tone: 'good' | 'bad') {
    const id = ++flyId
    set({ fly: { id, text, tone } })
    setTimeout(() => { if (get().fly?.id === id) set({ fly: null }) }, 1050)
  }
  function toast(text: string) {
    set({ toast: text })
    setTimeout(() => { if (get().toast === text) set({ toast: null }) }, 1700)
  }
  function signed(n: number): string {
    return (n >= 0 ? '+' : '-') + money(Math.abs(n))
  }
  function bumpRolling() {
    set({ rolling: true })
    if (rollTimer) clearTimeout(rollTimer)
    rollTimer = setTimeout(() => set({ rolling: false }), 560)
  }
  function showReveal(r: Reveal) {
    set({ reveal: r })
    if (revealTimer) clearTimeout(revealTimer)
    revealTimer = setTimeout(() => set({ reveal: null }), 2400)
  }

  // презентация событий (соло): звук, «улетающие» суммы, вскрытие карт
  function present(events: GameEvent[], actorId: string) {
    const you = get().youId
    for (const e of events) {
      switch (e.kind) {
        case 'roll': playSfx('dice'); bumpRolling(); break
        case 'move': playSfx('step'); break
        case 'passGo': if (e.playerId === you) flash(signed(e.amount), 'good'); playSfx('cash'); break
        case 'buy': playSfx('buy'); break
        case 'build': playSfx('build'); break
        case 'rent':
          playSfx('rent')
          if (e.from === you) flash(signed(-e.amount), 'bad')
          else if (e.to === you) flash(signed(e.amount), 'good')
          break
        case 'tax': if (e.playerId === you) flash(signed(-e.amount), 'bad'); playSfx('rent'); break
        case 'money':
          if (e.playerId === you && e.amount !== 0) flash(signed(e.amount), e.amount >= 0 ? 'good' : 'bad')
          playSfx(e.amount >= 0 ? 'cash' : 'rent')
          break
        case 'card':
          if (actorId === you) showReveal({ deck: e.deck, text: e.text })
          else toast(`${e.deck === 'chance' ? 'Шанс' : 'Казна'}: ${e.text}`)
          playSfx('card')
          break
        case 'jail': playSfx('jail'); if (e.playerId === you) toast('Тебя отправили на нары') ; break
        case 'bankrupt': { const p = get().solo?.players.find(x => x.id === e.playerId); if (p) toast(`${p.name} обанкротился`) ; break }
      }
    }
  }

  // -- SOLO -----------------------------------------------------------------
  function soloApply(action: Action) {
    const s = get().solo
    if (!s) return
    const r = applyAction(s, action)
    if (r.error) { haptic('warn'); return }
    set({ solo: r.state })
    present(r.events, action.playerId)
    afterSolo()
  }

  function afterSolo() {
    clearTimers()
    const s = get().solo
    if (!s) return
    if (s.status === 'finished') { finishSolo(s); return }
    const cur = s.players[s.turn]
    if (cur.isBot) {
      botTimer = setTimeout(() => {
        const st = get().solo
        if (!st || st.status !== 'playing') return
        const c = st.players[st.turn]
        if (!c.isBot) return
        soloApply(botDecide(st, c.id, get().difficulty))
      }, BOT_DELAY)
    }
    // иначе ход человека — интерфейс сам предложит нужное действие
  }

  function finishSolo(s: GameState) {
    clearTimers()
    const won = s.winnerId === get().youId
    const score = finalScore(s)
    const winner = s.players.find(p => p.id === s.winnerId)
    playSfx(won ? 'win' : 'lose')
    haptic(won ? 'success' : 'warn')
    set({ result: { won, score, winnerName: winner?.name ?? '-' }, reveal: null })
    api.soloResult(won, score).then(r => set({ profile: r.profile })).catch(() => {})
  }

  // -- ONLINE ---------------------------------------------------------------
  function applyRoom(next: RoomStateDto) {
    const prev = get().room
    const inLobby = get().screen === 'lobby'
    set({ room: next })

    // джойнер (и игрок быстрой игры) узнаёт о старте только по опросу:
    // как только партия началась — уводим его из лобби за стол.
    if (inLobby && next.room.started && next.view) { set({ screen: 'game' }); setChrome('game') }

    const v = next.view
    if (v) {
      // подсветить дубль/бросок и изменение своего баланса
      if (prev?.view && v.dice && (prev.view.dice?.[0] !== v.dice[0] || prev.view.dice?.[1] !== v.dice[1])) {
        bumpRolling(); playSfx('dice')
      }
      const me = v.players.find(p => p.id === v.youId)
      if (me) {
        const was = prevCash[v.youId]
        if (was != null && me.cash !== was) {
          const d = me.cash - was
          flash(signed(d), d >= 0 ? 'good' : 'bad')
          playSfx(d >= 0 ? 'cash' : 'rent')
        }
        prevCash[v.youId] = me.cash
      }
    }

    if (next.roundOver && !prev?.roundOver) {
      const youName = get().profile?.name
      const won = next.roundOver.winnerName === youName
      playSfx(won ? 'win' : 'lose')
      set({ result: { won, score: next.roundOver.score, winnerName: next.roundOver.winnerName }, reveal: null })
      api.profile().then(r => set({ profile: r.profile })).catch(() => {})
    }
  }

  function startPoll(code: string) {
    stopPoll()
    pollTimer = setInterval(async () => {
      try { applyRoom(await api.roomState(code)) } catch { /* transient */ }
    }, 1100)
  }

  async function onlineAct(action: Action) {
    const room = get().room
    if (!room) return
    try {
      applyRoom(await api.roomAction(room.room.code, action))
    } catch (e) {
      haptic('warn')
      const code = (e as { data?: { error?: string } })?.data?.error
      if (code && code !== 'not_your_turn' && code !== 'bad_phase') toast('Не получилось, попробуй ещё')
    }
  }

  function dispatch(action: Action) {
    if (get().mode === 'solo') soloApply(action)
    else onlineAct(action)
  }
  function meId(): string {
    return get().mode === 'solo' ? get().youId : (get().room?.view?.youId ?? '')
  }

  return {
    ready: false,
    screen: 'home',
    mode: null,
    profile: null,
    botUsername: 'magnat_play_bot',
    solo: null,
    youId: 'you',
    room: null,
    joinError: null,
    busy: false,
    toast: null,
    fly: null,
    rolling: false,
    reveal: null,
    buildOpen: false,
    infoTile: null,
    result: null,
    difficulty: 'medium',
    difficultyPick: false,
    leaderboard: [],

    async init() {
      try {
        const { profile, startParam, botUsername } = await api.auth()
        set({ profile, botUsername: botUsername || 'magnat_play_bot', ready: true })
        if (startParam?.startsWith('room_')) {
          const code = startParam.slice(5).toUpperCase()
          if (/^[A-Z0-9]{4}$/.test(code)) await get().joinRoom(code)
        }
      } catch {
        set({ ready: true }) // офлайн-соло всё равно доступно
      }
    },

    go(screen) {
      haptic('tap')
      if (screen !== 'lobby' && screen !== 'game') stopPoll()
      setChrome(screen === 'game' ? 'game' : 'menu')
      set({ screen })
    },

    startSolo(difficulty) {
      clearTimers(); stopPoll()
      const youId = 'you'
      const players = [
        { id: youId, name: get().profile?.name ?? 'Ты', isBot: false },
        { id: 'bot1', name: 'Аня', isBot: true },
        { id: 'bot2', name: 'Боря', isBot: true },
        { id: 'bot3', name: 'Витя', isBot: true },
      ]
      const seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
      const game = createGame({ players, seed })
      prevCash = {}
      setChrome('game')
      set({
        mode: 'solo', youId, solo: game, screen: 'game',
        result: null, reveal: null, buildOpen: false, infoTile: null, difficultyPick: false,
        difficulty: difficulty ?? get().difficulty,
      })
      haptic('tap')
      afterSolo()
    },

    view() {
      const st = get()
      if (st.mode === 'solo' && st.solo) return toView(st.solo, st.youId)
      if (st.mode === 'online' && st.room?.view) return st.room.view
      return null
    },

    roll() {
      const v = get().view()
      if (!v || !v.canRoll) return
      haptic('heavy')
      dispatch({ type: 'roll', playerId: meId() })
    },
    buyProp() {
      const v = get().view()
      if (!v || v.phase !== 'buy' || !v.canBuyPending) return
      haptic('success')
      dispatch({ type: 'buy', playerId: meId() })
    },
    declineProp() {
      const v = get().view()
      if (!v || v.phase !== 'buy') return
      haptic('tap')
      dispatch({ type: 'decline', playerId: meId() })
    },
    build(tileId) {
      const v = get().view()
      if (!v || !v.buildableIds.includes(tileId)) return
      haptic('success')
      set({ buildOpen: false })
      dispatch({ type: 'build', playerId: meId(), tileId })
    },
    jailPay() {
      const v = get().view()
      if (!v || !v.youInJail || !v.yourTurn) return
      haptic('tap')
      dispatch({ type: 'jailPay', playerId: meId() })
    },
    jailRoll() {
      const v = get().view()
      if (!v || !v.youInJail || !v.yourTurn) return
      haptic('heavy')
      dispatch({ type: 'jailRoll', playerId: meId() })
    },

    leaveGame() {
      clearTimers()
      const room = get().room
      if (room && get().mode === 'online') api.roomLeave(room.room.code).catch(() => {})
      stopPoll()
      setChrome('menu')
      set({ mode: null, solo: null, room: null, result: null, reveal: null, buildOpen: false, infoTile: null, screen: 'home' })
      haptic('tap')
    },

    async loadLeaderboard() {
      try { set({ leaderboard: (await api.leaderboard()).top }) } catch { /* offline */ }
    },

    async createRoom() {
      set({ busy: true, joinError: null })
      try {
        const st = await api.roomCreate()
        prevCash = {}
        set({ mode: 'online', room: st, screen: 'lobby', result: null, busy: false })
        startPoll(st.room.code)
      } catch { set({ busy: false, joinError: 'Не удалось создать комнату. Проверь связь.' }) }
    },

    async quickMatch() {
      set({ busy: true, joinError: null })
      try {
        const st = await api.roomQuick()
        prevCash = {}
        set({ mode: 'online', room: st, screen: 'lobby', result: null, busy: false })
        startPoll(st.room.code)
      } catch { set({ busy: false, joinError: 'Не удалось подобрать игру. Проверь связь.' }) }
    },

    async joinRoom(code) {
      set({ busy: true, joinError: null })
      try {
        const st = await api.roomJoin(code)
        prevCash = {}
        set({ mode: 'online', room: st, screen: 'lobby', result: null, busy: false })
        startPoll(st.room.code)
      } catch (e) {
        const err = (e as { data?: { error?: string } })?.data?.error
        set({ busy: false, joinError: err === 'no_room' ? 'Нет комнаты с таким кодом.' : err === 'already_started' ? 'Игра уже началась.' : err === 'full' ? 'В комнате нет мест.' : 'Не удалось войти.' })
      }
    },

    async startRoom() {
      const room = get().room
      if (!room) return
      set({ busy: true })
      try {
        const st = await api.roomStart(room.room.code)
        setChrome('game')
        set({ room: st, screen: 'game', busy: false })
        applyRoom(st)
      } catch { set({ busy: false }); toast('Не удалось начать') }
    },
  }
})
