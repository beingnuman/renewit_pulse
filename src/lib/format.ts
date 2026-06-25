const zar = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 2,
})

const int = new Intl.NumberFormat('en-ZA')

export function money(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? 0
  if (!isFinite(n as number)) return 'R0'
  return zar.format(n as number)
}

export function num(v: number | string | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : v ?? 0
  return int.format(isFinite(n as number) ? (n as number) : 0)
}

export function pct(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '%'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (!isFinite(n as number)) return '%'
  return `${Math.round(n as number)}%`
}
