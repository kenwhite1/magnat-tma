import { useStore } from '../store'

const RULES: { emoji: string; t: string; b: string }[] = [
  { emoji: '🎲', t: 'Бросай и ходи', b: 'В свой ход бросай два кубика и двигайся по кругу. Выпал дубль, ходишь ещё раз.' },
  { emoji: '🏠', t: 'Скупай недвижимость', b: 'Встал на свободную улицу, вокзал или предприятие, можешь купить. Прошёл «Старт», получаешь 2000.' },
  { emoji: '💰', t: 'Собирай аренду', b: 'Соперники, попавшие на твою клетку, платят тебе. Чем дороже участок, тем больше доход.' },
  { emoji: '🎨', t: 'Монополии и дома', b: 'Собрал всю цветную группу, аренда удваивается. На полной группе строй дома и отель, доход растёт в разы.' },
  { emoji: '❓', t: 'Шанс и Казна', b: 'Особые клетки дают карту события: деньги, переезд или дорога прямиком на нары.' },
  { emoji: '🔒', t: 'Тюрьма', b: 'Три дубля подряд или клетка «На нары» сажают в тюрьму. Выходишь по залогу, по карте или выбросив дубль.' },
  { emoji: '🏆', t: 'Победа', b: 'Не хватило денег, банк продаёт твои дома и закладывает участки. Совсем нечем платить, ты выбываешь. Последний магнат за столом побеждает.' },
]

export function Rules() {
  const go = useStore(s => s.go)
  return (
    <div className="page rise">
      <div className="page-head">
        <button className="round-btn" onClick={() => go('home')}>‹</button>
        <h1>Правила</h1>
      </div>

      <div className="rule" style={{ background: 'linear-gradient(180deg,#fff7e6,#f7ecd9)' }}>
        <div className="rt" style={{ marginBottom: 0, lineHeight: 1.45 }}>
          Магнат это уютная настолка про недвижимость в духе «Монополии». Скупай улицы, собирай
          цветные группы в <b style={{ color: 'var(--accent-deep)' }}>монополии</b> и застраивай их домами,
          чтобы соперники платили тебе по-крупному.
        </div>
      </div>

      {RULES.map((r, i) => (
        <div className="rule" key={i}>
          <div className="ic">{r.emoji}</div>
          <div>
            <div className="rt">{r.t}</div>
            <div className="rb">{r.b}</div>
          </div>
        </div>
      ))}

      <button className="btn gold block lg" style={{ marginTop: 8 }} onClick={() => useStore.setState({ difficultyPick: true })}>
        Сыграть одиночную партию 🎲
      </button>
    </div>
  )
}
