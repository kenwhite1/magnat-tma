// Знак «Магнат»: золотая монета с цилиндром магната и мягким блеском.
export function Logo({ size = 132 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" className="brand-logo" aria-label="Магнат">
      <defs>
        <radialGradient id="coin" cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#fff0c0" />
          <stop offset="46%" stopColor="#f8d77e" />
          <stop offset="100%" stopColor="#e0af3e" />
        </radialGradient>
        <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="100%" stopColor="#c88f20" />
        </linearGradient>
        <linearGradient id="hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3140" />
          <stop offset="100%" stopColor="#211c27" />
        </linearGradient>
      </defs>

      {/* coin body */}
      <circle cx="80" cy="84" r="60" fill="url(#rim)" />
      <circle cx="80" cy="84" r="53" fill="url(#coin)" />
      <circle cx="80" cy="84" r="53" fill="none" stroke="#fff6da" strokeWidth="2" opacity="0.6" />
      {/* inner ring of coin */}
      <circle cx="80" cy="84" r="45" fill="none" stroke="#cf9b2b" strokeWidth="2.4" opacity="0.55" strokeDasharray="3 5" />

      {/* top hat */}
      <g transform="translate(80 86)">
        <ellipse cx="0" cy="22" rx="40" ry="9" fill="url(#hat)" />
        <rect x="-24" y="-30" width="48" height="50" rx="7" fill="url(#hat)" />
        <rect x="-24" y="2" width="48" height="11" rx="4" fill="#c0402f" />
        <rect x="-24" y="-30" width="48" height="16" rx="7" fill="#463b50" opacity="0.7" />
      </g>

      {/* sheen */}
      <path d="M44 58 A53 53 0 0 1 96 40" fill="none" stroke="#fffbe9" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
      <circle cx="118" cy="52" r="4.5" fill="#fffbe9" opacity="0.85" />
    </svg>
  )
}
