// Lightweight line icons (24x24, stroke-based) for the nav bar.
// Inherit color via currentColor and size via the `size` prop.

type IconProps = { size?: number }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function IconDashboard({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconClaims({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 3v3h6V3" />
      <path d="M8 11h8M8 15h5" />
    </svg>
  )
}

export function IconReports({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-4 3 3 4-6" />
    </svg>
  )
}

export function IconDocuments({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  )
}

export function IconCustomers({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
      <path d="M21 20c0-2.4-1.4-4.5-3.5-5.4" />
    </svg>
  )
}

export function IconAllocate({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 7h6l4 10h6" />
      <path d="M16 4l3 3-3 3" />
      <path d="M8 17H4" />
    </svg>
  )
}

export function IconAdmin({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.6C8 19.3 5 15.4 5 11V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  )
}

export function IconCalendar({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  )
}

export function IconSearch({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

export function IconPlus({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconFuel({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M3 21h13" />
      <path d="M7 9h6" />
      <path d="M14 8l3 3v6a2 2 0 0 0 2-2V9.5L16.5 7" />
    </svg>
  )
}

export function IconHelp({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.7-2 2-2 3.5" />
      <path d="M12 17.5h.01" />
    </svg>
  )
}

export function IconChevron({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function IconLock({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function IconCamera({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}

export function IconListView({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  )
}

export function IconGridView({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconEdit({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 20h4l10-10a2 2 0 0 0-3-3L5 17z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  )
}

export function IconTrash({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function IconExternal({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </svg>
  )
}

export function IconFilePdf({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}

export function IconBriefcase({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  )
}
export function IconCar({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" />
      <path d="M3 17v-2a2 2 0 0 1 1-1.7L5 13h14l1 .3A2 2 0 0 1 21 15v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M7 15h.01M17 15h.01" />
    </svg>
  )
}
export function IconShield({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.6C8 19.3 5 15.4 5 11V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  )
}
export function IconHash({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
    </svg>
  )
}
export function IconUser({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
    </svg>
  )
}
export function IconBuilding({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    </svg>
  )
}
export function IconPalette({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.7-.8 1.7-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z" />
      <circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7.5" r="1" /><circle cx="14.5" cy="7.5" r="1" /><circle cx="17" cy="11" r="1" />
    </svg>
  )
}
export function IconClock({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
export function IconMoney({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  )
}
export function IconAlert({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}
export function IconBolt({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
    </svg>
  )
}

export function IconPrinter({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </svg>
  )
}
export function IconDownload({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  )
}
export function IconGauge({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M5 18a8 8 0 1 1 14 0" />
      <path d="M12 14l4-4" />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}
export function IconFlag({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 3.5L16 11H5" />
    </svg>
  )
}

export function IconLogout({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h11" />
    </svg>
  )
}

export function IconCopy({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function IconCheck({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function IconBox({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  )
}

export function IconWindscreen({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M12 4v14M3 11h18" />
    </svg>
  )
}

export function IconBattery({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <path d="M22 11v2" />
      <path d="M7 10v4M11 10v4" />
    </svg>
  )
}

export function IconNut({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden>
      <path d="M8 3h8l4 7-4 7H8l-4-7 4-7z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
