// --- Игровое поле «Магнат» --------------------------------------------------
// Классическая петля из 28 клеток: 4 угла + по 6 клеток на каждой стороне.
// Все данные (цена, аренда, стоимость дома) живут здесь, а движок только
// читает их, поэтому баланс легко подкрутить в одном месте.

export type TileType =
  | 'go' // старт
  | 'prop' // улица (цветная группа)
  | 'rail' // вокзал
  | 'util' // предприятие (электро/вода)
  | 'tax' // налог
  | 'chance' // шанс
  | 'chest' // казна
  | 'jail' // тюрьма (просто стоишь)
  | 'gojail' // на нары
  | 'parking' // отдых

export type Group =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'rail'
  | 'util'

export interface Tile {
  id: number
  type: TileType
  name: string
  short: string // короткая подпись на клетке поля
  group?: Group
  price?: number // цена покупки (prop / rail / util)
  rent?: number[] // аренда по числу домов [0,1,2,3,4,отель] для prop
  houseCost?: number // цена одного дома (prop)
  tax?: number // сумма налога (tax)
}

// Метаданные цветных групп: цвет полосы и стоимость домика.
export const GROUPS: Record<Group, { color: string; ink: string; size: number; houseCost: number; label: string }> = {
  brown: { color: '#8d5a2b', ink: '#fff', size: 2, houseCost: 500, label: 'Окраина' },
  lightblue: { color: '#6fb7d8', ink: '#0b3346', size: 2, houseCost: 500, label: 'Тихий центр' },
  pink: { color: '#d24e8f', ink: '#fff', size: 2, houseCost: 1000, label: 'Проспекты' },
  orange: { color: '#ef8f2a', ink: '#fff', size: 2, houseCost: 1000, label: 'Бульвары' },
  red: { color: '#d9433a', ink: '#fff', size: 2, houseCost: 1500, label: 'Набережные' },
  yellow: { color: '#e8bd2b', ink: '#5c4326', size: 2, houseCost: 1500, label: 'Элитка' },
  rail: { color: '#3a3f52', ink: '#fff', size: 4, houseCost: 0, label: 'Вокзалы' },
  util: { color: '#5aa06a', ink: '#fff', size: 2, houseCost: 0, label: 'Предприятия' },
}

const P = (
  id: number,
  name: string,
  short: string,
  group: Group,
  price: number,
  rent: number[],
): Tile => ({ id, type: 'prop', name, short, group, price, rent, houseCost: GROUPS[group].houseCost })

const R = (id: number, name: string, short: string): Tile => ({
  id,
  type: 'rail',
  name,
  short,
  group: 'rail',
  price: 2000,
})

const U = (id: number, name: string, short: string): Tile => ({
  id,
  type: 'util',
  name,
  short,
  group: 'util',
  price: 1500,
})

// 28 клеток по часовой стрелке, старт в левом нижнем углу.
export const BOARD: Tile[] = [
  { id: 0, type: 'go', name: 'Старт', short: 'СТАРТ' },
  P(1, 'Заречная', 'Заречная', 'brown', 600, [30, 150, 450, 1300, 2250, 4000]),
  { id: 2, type: 'chest', name: 'Казна', short: 'Казна' },
  P(3, 'Полевая', 'Полевая', 'brown', 600, [30, 150, 450, 1300, 2250, 4000]),
  { id: 4, type: 'tax', name: 'Подоходный налог', short: 'Налог', tax: 1000 },
  R(5, 'Южный вокзал', 'Ю. вокзал'),
  P(6, 'Садовая', 'Садовая', 'lightblue', 1000, [60, 300, 900, 2700, 4000, 5500]),
  { id: 7, type: 'jail', name: 'Тюрьма', short: 'Тюрьма' },
  P(8, 'Лесная', 'Лесная', 'lightblue', 1000, [60, 300, 900, 2700, 4000, 5500]),
  { id: 9, type: 'chance', name: 'Шанс', short: 'Шанс' },
  P(10, 'Гагарина', 'Гагарина', 'pink', 1400, [100, 500, 1500, 4500, 6250, 7500]),
  U(11, 'Электростанция', 'Электро'),
  P(12, 'Пушкина', 'Пушкина', 'pink', 1400, [100, 500, 1500, 4500, 6250, 7500]),
  R(13, 'Западный вокзал', 'З. вокзал'),
  { id: 14, type: 'parking', name: 'Отдых', short: 'Отдых' },
  P(15, 'Арбат', 'Арбат', 'orange', 1800, [140, 700, 2000, 5500, 7500, 9500]),
  { id: 16, type: 'chest', name: 'Казна', short: 'Казна' },
  P(17, 'Тверская', 'Тверская', 'orange', 1800, [140, 700, 2000, 5500, 7500, 9500]),
  R(18, 'Северный вокзал', 'С. вокзал'),
  P(19, 'Невский', 'Невский', 'red', 2200, [180, 900, 2500, 7000, 8750, 10500]),
  { id: 20, type: 'chance', name: 'Шанс', short: 'Шанс' },
  { id: 21, type: 'gojail', name: 'На нары', short: 'На нары' },
  P(22, 'Дерибасовская', 'Дерибас.', 'red', 2200, [180, 900, 2500, 7000, 8750, 10500]),
  U(23, 'Водоканал', 'Водокан.'),
  P(24, 'Рублёвка', 'Рублёвка', 'yellow', 2600, [260, 1300, 3900, 9000, 11000, 12750]),
  R(25, 'Восточный вокзал', 'В. вокзал'),
  P(26, 'Остоженка', 'Остожен.', 'yellow', 2600, [260, 1300, 3900, 9000, 11000, 12750]),
  { id: 27, type: 'tax', name: 'Налог на роскошь', short: 'Роскошь', tax: 750 },
]

export const BOARD_SIZE = BOARD.length // 28
export const GO_INDEX = 0
export const JAIL_INDEX = 7
export const GOJAIL_INDEX = 21

// Экономика
export const START_CASH = 15000
export const GO_SALARY = 2000
export const JAIL_FINE = 500
export const RAIL_RENT = [250, 500, 1000, 2000] // по числу вокзалов у владельца
export const UTIL_MULT = [4, 10] // множитель к сумме кубиков (1 или 2 предприятия)
export const MAX_HOUSES = 5 // 4 дома + отель
export const MAX_ROUNDS = 40 // мягкий предел, чтобы партия не тянулась вечно

// Быстрый доступ к клетке по индексу с защитой от выхода за границы.
export function tileAt(pos: number): Tile {
  return BOARD[((pos % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE]
}

// Индексы всех клеток одной группы (для проверки монополии).
export function groupTiles(group: Group): number[] {
  return BOARD.filter(t => t.group === group).map(t => t.id)
}
