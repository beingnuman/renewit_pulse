import { useNavigate } from 'react-router-dom'
import type { SummaryRow } from '../lib/api'
import { money, num, pct } from '../lib/format'

function n(v: number | string | null | undefined): number {
  const x = typeof v === 'string' ? parseFloat(v) : v ?? 0
  return isFinite(x as number) ? (x as number) : 0
}

export function SummaryTable({ rows }: { rows: SummaryRow[] }) {
  const navigate = useNavigate()

  if (rows.length === 0) {
    return <div className="empty">No data for this period.</div>
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.units += n(r.units)
      acc.sales += n(r.latest_sales_value)
      acc.parts += n(r.parts_maximum)
      return acc
    },
    { units: 0, sales: 0, parts: 0 },
  )
  const totalCos = totals.sales > 0 ? (totals.parts / totals.sales) * 100 : 0

  return (
    <div className="table-scroll">
      <table className="summary">
        <thead>
          <tr>
            <th>Department</th>
            <th className="r">Units</th>
            <th className="r">Latest Sales Value</th>
            <th className="r">Parts Maximum</th>
            <th className="r">COS%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.department}
              className="clickable"
              onClick={() => navigate(`/status/${encodeURIComponent(r.department)}`)}
            >
              <td>{r.department}</td>
              <td className="r">{num(r.units)}</td>
              <td className="r">{money(r.latest_sales_value)}</td>
              <td className="r">{money(r.parts_maximum)}</td>
              <td className="r cos">{pct(r.cos_percentage)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>TOTAL</td>
            <td className="r">{num(totals.units)}</td>
            <td className="r">{money(totals.sales)}</td>
            <td className="r">{money(totals.parts)}</td>
            <td className="r cos">{pct(totalCos)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
