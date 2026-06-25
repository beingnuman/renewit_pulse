import { Fragment } from 'react'
import './SalesTeamPerformance.css'

function fmt(n) {
  if (n == null) return ''
  return Number(n).toLocaleString('en-ZA')
}

function dayLabel(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
}

function varClass(v) {
  if (v == null) return ''
  if (v < 0) return 'stp-neg'
  if (v > 0) return 'stp-pos'
  return ''
}

export default function SalesTeamPerformance({
  data,
  title = 'Sales Team Performance',
  subtitle = 'Key Account Managers, Estimators, Claims Handlers, Booking Clerk',
}) {
  if (!data) return null
  const { weekDays, sections, productionDays, totalDays } = data

  return (
    <div className="stp-card">
      <div className="stp-head">
        {title}
        <span className="stp-sub">{subtitle} · R&apos;000</span>
      </div>
      <div className="stp-scroll">
        <table className="stp-table">
          <thead>
            <tr>
              <th className="stp-row-label" />
              {weekDays.map((d) => <th key={d} className="stp-num">{dayLabel(d)}</th>)}
              <th className="stp-num stp-week">Week</th>
              <th className="stp-num">Wk Tgt</th>
              <th className="stp-num">Wk Var</th>
              <th className="stp-num stp-sep">Month</th>
              <th className="stp-num">MTD Tgt</th>
              <th className="stp-num">Target</th>
              <th className="stp-num">Var</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <Fragment key={sec.title}>
                <tr className="stp-section"><td colSpan={13}>{sec.title}</td></tr>
                {sec.rows.map((r, i) => (
                  <tr key={i} className={r.isTotal ? 'stp-total' : ''}>
                    <td className="stp-row-label">{r.label}</td>
                    {r.perDay.map((v, j) => <td key={j} className="stp-num">{v ? fmt(v) : ''}</td>)}
                    <td className="stp-num stp-week">{fmt(r.week)}</td>
                    <td className="stp-num">{fmt(r.weeklyTarget)}</td>
                    <td className={`stp-num ${varClass(r.weeklyVariance)}`}>{fmt(r.weeklyVariance)}</td>
                    <td className="stp-num stp-sep stp-week">{fmt(r.month)}</td>
                    <td className="stp-num">{fmt(r.monthlyTargetToDate)}</td>
                    <td className="stp-num">{fmt(r.monthlyTarget)}</td>
                    <td className={`stp-num ${varClass(r.monthlyVariance)}`}>{fmt(r.monthlyVariance)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {productionDays != null && (
        <div className="stp-foot">Production day {productionDays} of {totalDays}</div>
      )}
    </div>
  )
}
