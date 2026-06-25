import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Logo } from './Logo'
import { UserMenu } from './UserMenu'
import { StandaloneFuelSlipModal } from './StandaloneFuelSlip'
import { GlobalSearch } from './GlobalSearch'
import {
  IconDashboard,
  IconClaims,
  IconReports,
  IconDocuments,
  IconCustomers,
  IconAllocate,
  IconAdmin,
  IconCalendar,
  IconPlus,
  IconFuel,
  IconHelp,
  IconLogout,
} from './icons'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/claims', label: 'All Claims', Icon: IconClaims },
  { to: '/reports', label: 'Reports', Icon: IconReports },
  { to: '/documents', label: 'Documents', Icon: IconDocuments },
  { to: '/customers', label: 'All Customers', Icon: IconCustomers },
  { to: '/allocate', label: 'Allocate CSA', Icon: IconAllocate, requiresCsa: true },
  { to: '/admin', label: 'Admin', Icon: IconAdmin },
  { to: '/calendar', label: 'Calendar', Icon: IconCalendar },
]

export function Layout() {
  const { profile, signOut, branches, branchId } = useAuth()
  const navigate = useNavigate()
  const [showFuel, setShowFuel] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  const currentBranch = branches.find((b) => b.id === branchId)?.branch_name ?? profile?.branch

  const logout = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <Logo branch={currentBranch ?? 'Rivonia'} height={36} />
        </div>

        <div className="topbar-center">
          <div className="center-cluster">
            <GlobalSearch />
            <button className="new-claim" onClick={() => navigate('/new-claim')}>
              <IconPlus size={16} /> <span className="new-claim-label">New Claim</span>
            </button>
            {profile?.canFuelSlips && (
              <button className="icon-btn" title="New fuel slip" aria-label="New fuel slip" onClick={() => setShowFuel(true)}>
                <IconFuel size={18} />
              </button>
            )}
            <button className="icon-btn" title="Help" aria-label="Help">
              <IconHelp size={18} />
            </button>
          </div>
        </div>

        <div className="topbar-right">
          <UserMenu />
          <button className="logout" onClick={logout} title="Log out" aria-label="Log out">
            <IconLogout size={18} />
          </button>
        </div>
      </header>

      <nav className={`nav${navOpen ? ' open' : ''}`}>
        <button
          className="nav-toggle"
          aria-label="Toggle menu"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          <span className="nav-toggle-bars" aria-hidden>
            <span /><span /><span />
          </span>
          <span className="nav-toggle-label">Menu</span>
        </button>
        <div className="nav-inner">
          {NAV.filter((n) => !n.requiresCsa || profile?.canAllocateCsa).map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'active' : '')}
              end={to === '/claims'}
              onClick={() => setNavOpen(false)}
            >
              <span className="nav-icon" aria-hidden>
                <Icon />
              </span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <main>
        <Outlet />
      </main>

      {showFuel && <StandaloneFuelSlipModal onClose={() => setShowFuel(false)} />}
    </div>
  )
}
