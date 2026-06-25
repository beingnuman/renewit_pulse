import { useAuth } from '../auth'

export function Loader({
  label = 'Loading…',
  compact = false,
}: {
  label?: string
  compact?: boolean
  height?: number
}) {
  const { branches, branchId, profile } = useAuth()
  const branchRaw =
    branches.find((b) => b.id === branchId)?.branch_name ?? profile?.branch ?? 'Group'
  const branch = branchRaw.split('-').pop()?.trim() || 'Group'

  return (
    <div className={`loader${compact ? ' compact' : ''}`}>
      <svg className="car-loader" viewBox="0 0 300 180" role="img" aria-label="Loading">
        <defs>
          <linearGradient id="cl-shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="cl-body">
            <path d="M34,122 L34,94 Q34,88 40,88 L80,88 L98,70 Q102,66 108,66 L160,66 Q167,66 171,71 L188,88 L218,94 Q226,96 226,106 L226,122 Z" />
          </clipPath>
        </defs>

        {/* Renew-it sign */}
        <g className="cl-sign">
          <rect x="74" y="8" width="62" height="24" rx="6" fill="var(--navy)" />
          <rect x="124" y="8" width="62" height="24" rx="6" fill="var(--brand-red)" />
          <text x="105" y="25" className="cl-sign-t" textAnchor="middle">Renew-it</text>
          <text x="155" y="24" className="cl-sign-t cl-sign-sm" textAnchor="middle">{branch}</text>
        </g>

        <ellipse className="cl-shadow" cx="130" cy="152" rx="116" ry="6" />
        <line className="cl-road" x1="18" y1="153" x2="242" y2="153" />

        {/* inspector with clipboard (far left) */}
        <g>
          <rect className="cl-overall" x="9" y="138" width="5" height="13" rx="2" />
          <rect className="cl-overall" x="17" y="138" width="5" height="13" rx="2" />
          <rect className="cl-overall" x="8" y="116" width="16" height="24" rx="6" />
          <circle className="cl-skin" cx="16" cy="108" r="6.5" />
          <path className="cl-cap-violet" d="M9.5,107 A6.5,6.5 0 0,1 22.5,107 L23,107 Q16,101 9,107 Z" />
          <g className="cl-check">
            <line x1="20" y1="122" x2="27" y2="128" className="cl-arm-l" />
            <rect x="25" y="124" width="9" height="11" rx="1.5" fill="#fff" stroke="#cdd6e4" />
            <line x1="27" y1="128" x2="32" y2="128" stroke="#9aa6b6" strokeWidth="1.4" />
            <line x1="27" y1="131" x2="32" y2="131" stroke="#9aa6b6" strokeWidth="1.4" />
          </g>
        </g>

        {/* car */}
        <g className="cl-car">
          <path
            className="cl-paint"
            d="M34,122 L34,94 Q34,88 40,88 L80,88 L98,70 Q102,66 108,66 L160,66 Q167,66 171,71 L188,88 L218,94 Q226,96 226,106 L226,122 Z"
          />
          <path className="cl-arch" d="M68,122 A20,20 0 0,1 108,122 Z" />
          <path className="cl-arch" d="M152,122 A20,20 0 0,1 192,122 Z" />
          <path className="cl-glass" d="M106,86 L116,74 Q118,72 122,72 L140,72 L140,86 Z" />
          <path className="cl-glass" d="M147,72 L160,72 Q164,72 167,76 L175,86 L147,86 Z" />
          <rect className="cl-stripe" x="34" y="113" width="192" height="5" rx="2.5" />
          <rect className="cl-handle" x="150" y="99" width="12" height="3" rx="1.5" />
          <circle className="cl-headlight" cx="222" cy="104" r="4" />
          <circle className="cl-taillight" cx="38" cy="104" r="3" />
          <g clipPath="url(#cl-body)">
            <rect className="cl-shine" x="-70" y="62" width="46" height="70" fill="url(#cl-shine)" />
          </g>
          <g transform="translate(88,126)">
            <circle r="18" className="cl-tire" />
            <circle r="11.5" className="cl-rim" />
            <g className="cl-spin">
              <line x1="0" y1="-9" x2="0" y2="9" className="cl-spoke" />
              <line x1="-9" y1="0" x2="9" y2="0" className="cl-spoke" />
              <line x1="-6.4" y1="-6.4" x2="6.4" y2="6.4" className="cl-spoke" />
              <line x1="-6.4" y1="6.4" x2="6.4" y2="-6.4" className="cl-spoke" />
              <circle r="3.2" className="cl-hub" />
            </g>
          </g>
          <g transform="translate(172,126)">
            <circle r="18" className="cl-tire" />
            <circle r="11.5" className="cl-rim" />
            <g className="cl-spin">
              <line x1="0" y1="-9" x2="0" y2="9" className="cl-spoke" />
              <line x1="-9" y1="0" x2="9" y2="0" className="cl-spoke" />
              <line x1="-6.4" y1="-6.4" x2="6.4" y2="6.4" className="cl-spoke" />
              <line x1="-6.4" y1="6.4" x2="6.4" y2="-6.4" className="cl-spoke" />
              <circle r="3.2" className="cl-hub" />
            </g>
          </g>
        </g>

        {/* front-wheel mechanic (left) */}
        <g>
          <path className="cl-overall" d="M30,150 L30,140 Q30,136 34,136 L46,136 L46,150 Z" />
          <path className="cl-overall" d="M44,150 L44,142 L58,134 L64,140 L52,150 Z" />
          <path className="cl-overall" d="M30,138 Q28,120 40,116 L52,114 Q58,124 54,138 Z" />
          <circle className="cl-skin" cx="44" cy="108" r="7.5" />
          <path className="cl-cap-red" d="M36,107 A8,8 0 0,1 52,107 L53,107 Q44,100 35,107 Z" />
          <g className="cl-arm">
            <line x1="48" y1="120" x2="78" y2="125" className="cl-arm-l" />
            <rect x="76" y="120" width="11" height="4" rx="2" className="cl-wrench" transform="rotate(12 81 122)" />
          </g>
          <path className="cl-spark" d="M88,121 L89.2,124.2 L92,125 L89.2,125.8 L88,129 L86.8,125.8 L84,125 L86.8,124.2 Z" />
        </g>

        {/* rear-wheel mechanic (right of car) */}
        <g>
          <path className="cl-overall" d="M236,150 L236,140 Q236,136 232,136 L220,136 L220,150 Z" />
          <path className="cl-overall" d="M222,150 L222,142 L208,134 L202,140 L214,150 Z" />
          <path className="cl-overall" d="M236,138 Q238,120 226,116 L214,114 Q208,124 212,138 Z" />
          <circle className="cl-skin" cx="222" cy="108" r="7.5" />
          <path className="cl-cap-amber" d="M214,107 A8,8 0 0,1 230,107 L231,107 Q222,100 213,107 Z" />
          <g className="cl-arm2">
            <line x1="218" y1="120" x2="190" y2="125" className="cl-arm-l" />
            <rect x="181" y="120" width="11" height="4" rx="2" className="cl-wrench" transform="rotate(-12 186 122)" />
          </g>
          <path className="cl-spark cl-spark-b" d="M180,121 L181.2,124.2 L184,125 L181.2,125.8 L180,129 L178.8,125.8 L176,125 L178.8,124.2 Z" />
        </g>

        {/* painter spraying fresh paint (far right) */}
        <g>
          <rect className="cl-overall" x="266" y="138" width="5" height="13" rx="2" />
          <rect className="cl-overall" x="274" y="138" width="5" height="13" rx="2" />
          <rect className="cl-overall" x="264" y="114" width="16" height="25" rx="6" />
          <circle className="cl-skin" cx="272" cy="106" r="6.5" />
          <path className="cl-cap-navy" d="M265.5,105 A6.5,6.5 0 0,1 278.5,105 L279,105 Q272,99 265,105 Z" />
          <line x1="266" y1="120" x2="250" y2="126" className="cl-arm-l" />
          <rect x="244" y="123" width="9" height="6" rx="1.5" className="cl-gun" />
          <rect x="241" y="124.5" width="4" height="3" className="cl-gun" />
          <circle className="cl-mist cl-mist1" cx="238" cy="126" r="2" />
          <circle className="cl-mist cl-mist2" cx="238" cy="123" r="1.6" />
          <circle className="cl-mist cl-mist3" cx="238" cy="129" r="1.6" />
        </g>
      </svg>
      {label && <div className="loader-label">{label}</div>}
    </div>
  )
}
