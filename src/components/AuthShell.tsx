import type { ReactNode } from 'react'
import { Logo } from './Logo'
import { IconGauge, IconClaims, IconShield } from './icons'

const FEATURES = [
  { Icon: IconGauge, title: 'Live claim & WIP tracking', sub: 'Every job in real time.' },
  { Icon: IconClaims, title: 'Role-aware workflows', sub: 'The right tools for each team member.' },
  { Icon: IconShield, title: 'Secure single sign-on', sub: 'Microsoft-backed access, no extra passwords.' },
]

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <span className="auth-orb auth-orb-1" aria-hidden />
        <span className="auth-orb auth-orb-2" aria-hidden />
        <span className="auth-orb auth-orb-3" aria-hidden />

        <div className="auth-hero-top">
          <Logo branch="Group" height={40} />
        </div>

        <div className="auth-hero-mid">
          <h2 className="auth-hero-title">Repair management,<br />reimagined.</h2>
          <p className="auth-hero-sub">
            Renew-it Pulse brings quoting, conversions, production and reporting into one calm,
            connected workspace.
          </p>
          <ul className="auth-features">
            {FEATURES.map(({ Icon, title, sub }) => (
              <li key={title} className="auth-feature">
                <span className="auth-feature-ic"><Icon size={18} /></span>
                <span className="auth-feature-text">
                  <span className="auth-feature-title">{title}</span>
                  <span className="auth-feature-sub">{sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="auth-hero-foot">© {new Date().getFullYear()} Renew-it Group · Autobody Specialists</div>
      </aside>

      <main className="auth-panel">
        {children}
      </main>
    </div>
  )
}
