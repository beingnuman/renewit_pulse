import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { canAccessPath } from './lib/permissions'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { StaffLogin } from './pages/StaffLogin'
import { AuthCallback } from './pages/AuthCallback'
import { Dashboard } from './pages/Dashboard'
import { AllClaims } from './pages/AllClaims'
import { ClaimsView } from './pages/ClaimsView'
import { ClaimDetail } from './pages/ClaimDetail'
import { Documents } from './pages/Documents'
import { AllocateCsa } from './pages/AllocateCsa'
import { Admin } from './pages/Admin'
import { SearchResults } from './pages/SearchResults'
import { Calendar } from './pages/Calendar'
import { NewClaim } from './pages/NewClaim'
import { Customers } from './pages/Customers'
import { DisclaimerForm } from './pages/DisclaimerForm'
import Reports from './reports/pages/Reports'
import { Loader } from './components/Loader'
import './App.css'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  return session ? <>{children}</> : <Navigate to="/" replace />
}

// Redirect to the dashboard if the signed-in user's role can't access this nav path.
function RequireNav({ path, children }: { path: string; children: React.ReactNode }) {
  const { profile } = useAuth()
  return canAccessPath(profile, path) ? <>{children}</> : <Navigate to="/dashboard" replace />
}

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="app-loading"><Loader label="" height={56} /></div>
  }

  return (
    <Routes>
      {/* Public, no-auth customer signing page */}
      <Route path="/disclaimer/:token" element={<DisclaimerForm />} />

      {/* Public — Microsoft SSO lands here; must NOT require login */}
      <Route path="/auth-callback" element={<AuthCallback />} />

      <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />

      {/* Unlisted email/password sign-in for testers (not linked from the SSO screen) */}
      <Route path="/staff-login" element={session ? <Navigate to="/dashboard" replace /> : <StaffLogin />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/claim/:id" element={<ClaimDetail />} />
        <Route path="/kpi/:filterType" element={<ClaimsView mode="kpi" />} />
        <Route path="/status/:statusName" element={<ClaimsView mode="status" />} />
        <Route path="/claims" element={<AllClaims />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/new-claim" element={<NewClaim />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/customers" element={<RequireNav path="/customers"><Customers /></RequireNav>} />
        <Route path="/allocate" element={<RequireNav path="/allocate"><AllocateCsa /></RequireNav>} />
        <Route path="/admin" element={<RequireNav path="/admin"><Admin /></RequireNav>} />
        <Route path="/calendar" element={<RequireNav path="/calendar"><Calendar /></RequireNav>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
