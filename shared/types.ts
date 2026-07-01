// Общие DTO для клиента и сервера.
import type { GameView } from './view'

export interface Profile {
  id: number
  name: string
  wins: number
  losses: number
  played: number
  streak: number
  bestStreak: number
  coins: number
}

export interface RoomPlayerDto {
  id: string
  name: string
  isBot: boolean
  isHost: boolean
  connected: boolean
}

export interface RoomDto {
  code: string
  hostId: string
  started: boolean
  players: RoomPlayerDto[]
  maxPlayers: number
  quick: boolean
}

// Что получает опрашивающий онлайн-клиент.
export interface RoomStateDto {
  room: RoomDto
  version: number
  view: GameView | null // null пока в лобби
  roundOver: { winnerName: string; score: number } | null
}

export type { GameView }
