import { useEffect, useState } from 'react'
import { useAuth } from '../auth'
import {
  getChDashboard,
  getSalesSummary,
  getProductionSummary,
  getInvoicingSummary,
  type ChDashboard,
  type SummaryRow,
} from '../lib/api'
import { num } from '../lib/format'
import { Panel } from '../components/Panel'
import { KpiPanel } from '../components/KpiPanel'
import { SummaryTable } from '../components/SummaryTable'
import { Loader } from '../components/Loader'
import {
  IconReports,
  IconDashboard,
  IconCustomers,
  IconClaims,
} from '../components/icons'

interface State {
  ch: ChDashboard | null
  sales: SummaryRow[]
  production: SummaryRow[]
  invoicing: SummaryRow[]
}

export function Dashboard() {
  const { branchId } = useAuth()

  const [state, setState] = useState<State>({ ch: null, sales: [], production: [], invoicing: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [ch, sales, production, invoicing] = await Promise.all([
          getChDashboard(branchId),
          getSalesSummary({ branchId }),
          getProductionSummary({ branchId }),
          getInvoicingSummary({ branchId }),
        ])
        if (active) setState({ ch, sales, production, invoicing })
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [branchId])

  if (loading) {
    return <div className="page"><div className="panel-skeleton"><Loader label="Loading dashboard…" /></div></div>
  }
  if (error) {
    return (
      <div className="page">
        <div className="login-error">Couldn’t load dashboard: {error}</div>
      </div>
    )
  }

  const refreshed = state.ch?.data_refreshed_at
    ? new Date(state.ch.data_refreshed_at).toLocaleString('en-ZA', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  return (
    <div className="page">
      <Panel
        title="Operational KPI’s and Stats"
        icon={<IconReports size={18} />}
        right={
          <span className="panel-meta">
            {num(state.ch?.total_jobs ?? 0)} jobs
            {refreshed && <> · updated {refreshed}</>}
          </span>
        }
      >
        {state.ch ? <KpiPanel data={state.ch} /> : <div className="empty">No KPI data.</div>}
      </Panel>

      <Panel title="Sales Summary" icon={<IconDashboard size={18} />}>
        <SummaryTable rows={state.sales} />
      </Panel>

      <Panel title="Production Summary" icon={<IconClaims size={18} />}>
        <SummaryTable rows={state.production} />
      </Panel>

      <Panel title="Invoicing Summary" icon={<IconCustomers size={18} />}>
        <SummaryTable rows={state.invoicing} />
      </Panel>
    </div>
  )
}
