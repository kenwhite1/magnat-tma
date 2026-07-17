// --- Колоды «Шанс» и «Казна» -------------------------------------------------
// Каждая карта это чистый эффект над состоянием. Движок тянет верхнюю карту,
// применяет её и кладёт вниз колоды. Тексты короткие и на русском, чтобы
// красиво показывать во всплывающей карточке.

export type CardEffect =
  | { kind: 'money'; amount: number } // +/- в банк
  | { kind: 'collect'; amount: number } // получить с каждого соперника
  | { kind: 'pay'; amount: number } // заплатить каждому сопернику
  | { kind: 'move'; to: number } // переместиться на клетку (мимо старта = зарплата)
  | { kind: 'moveBack'; steps: number } // отступить назад на N клеток
  | { kind: 'gojail' } // сразу на нары
  | { kind: 'getout' } // «выйти из тюрьмы бесплатно»

export interface DeckCard {
  id: string
  text: string
  effect: CardEffect
}

// «Шанс» - резкие события про движение и удачу.
export const CHANCE: DeckCard[] = [
  { id: 'c1', text: 'Беспроигрышная лотерея! Банк выплачивает 2000.', effect: { kind: 'money', amount: 2000 } },
  { id: 'c2', text: 'Проезд до Старта. Получите зарплату.', effect: { kind: 'move', to: 0 } },
  { id: 'c3', text: 'Штраф за превышение скорости: 400.', effect: { kind: 'money', amount: -400 } },
  { id: 'c4', text: 'Вас переводят на Невский проспект.', effect: { kind: 'move', to: 19 } },
  { id: 'c5', text: 'Отойдите на 3 клетки назад.', effect: { kind: 'moveBack', steps: 3 } },
  { id: 'c6', text: 'Полиция задержала вас. Отправляйтесь на нары.', effect: { kind: 'gojail' } },
  { id: 'c7', text: 'Освобождение из тюрьмы без залога. Сохраните карту.', effect: { kind: 'getout' } },
  { id: 'c8', text: 'Дивиденды по акциям: 1000.', effect: { kind: 'money', amount: 1000 } },
]

// «Казна» - про деньги и людей вокруг.
export const CHEST: DeckCard[] = [
  { id: 'k1', text: 'Возврат налогов. Банк выплачивает 1500.', effect: { kind: 'money', amount: 1500 } },
  { id: 'k2', text: 'День рождения! Каждый игрок дарит вам 300.', effect: { kind: 'collect', amount: 300 } },
  { id: 'k3', text: 'Оплата счёта за лечение: 600.', effect: { kind: 'money', amount: -600 } },
  { id: 'k4', text: 'Наследство. Банк выплачивает 2000.', effect: { kind: 'money', amount: 2000 } },
  { id: 'k5', text: 'Вы устроили вечеринку. Заплатите каждому по 250.', effect: { kind: 'pay', amount: 250 } },
  { id: 'k6', text: 'Проезд до Старта. Получите зарплату.', effect: { kind: 'move', to: 0 } },
  { id: 'k7', text: 'Освобождение из тюрьмы без залога. Сохраните карту.', effect: { kind: 'getout' } },
  { id: 'k8', text: 'Штраф за парковку: 300.', effect: { kind: 'money', amount: -300 } },
]
