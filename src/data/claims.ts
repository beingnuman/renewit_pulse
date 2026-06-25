// Mock claims data + status workflow for the Renew-it Pulse migration.
// Mirrors the columns shown in the Bubble dashboard list view.

export type TD = 'T' | 'D'

export interface Claim {
  drNumber: string
  roNumber: string
  aging: number
  dip: number
  registration: string
  status: string
  manufacturer: string
  csa: string
  insurer: string
  approvedValue: number
  customer: string
  contact: string
  speedShop: boolean
  td: TD
  warranty?: boolean
  upsell?: boolean
}

// The claim workflow statuses. Each becomes a tile on the dashboard.
export interface StatusDef {
  code: string
  label: string
  accent: string
}

export const STATUSES: StatusDef[] = [
  { code: '01-NEW', label: 'New', accent: '#2563eb' },
  { code: '10-ESTIMATE', label: 'Estimate', accent: '#7c3aed' },
  { code: '20-AUTHORISED', label: 'Authorised', accent: '#0891b2' },
  { code: '30-IN-PROGRESS', label: 'In Progress', accent: '#0d9488' },
  { code: '40-PARTS', label: 'Awaiting Parts', accent: '#d97706' },
  { code: '50-QC', label: 'Quality Control', accent: '#9333ea' },
  { code: '60-READY', label: 'Ready for Collection', accent: '#16a34a' },
  { code: '99-IMPORTED', label: 'Imported', accent: '#64748b' },
]

const MANUFACTURERS = [
  'BMW', 'VOLKSWAGEN', 'SUZUKI', 'MERCEDES-BENZ', 'TOYOTA',
  'CATERPILLAR', 'FORD', 'AUDI', 'NISSAN', 'HYUNDAI',
]

const FIRST = ['RASOOL', 'MAKGALEFA', 'AMANDA', 'JOHN', 'THANDO', 'PRIYA', 'SIPHO', 'LERATO', 'DEVEN', 'NOMSA']
const LAST = ['RAJ', 'GABRIEL', 'MNISI', 'SMITH', 'NKOSI', 'PATEL', 'DLAMINI', 'KHUMALO', 'VAN WYK', 'MOLEFE']

function rand(seed: number) {
  // deterministic pseudo-random so the list is stable between renders
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function plate(seed: number) {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  const d = (n: number) => Math.floor(rand(seed + n) * 10)
  const l = (n: number) => L[Math.floor(rand(seed + n) * L.length)]
  return `${l(1)}${l(2)}${d(3)}${d(4)}${l(5)}${l(6)}GP`
}

// Generate a deterministic set of claims spread across statuses.
function generate(): Claim[] {
  const claims: Claim[] = []
  const dr = 74600
  for (let i = 0; i < 140; i++) {
    const s = STATUSES[Math.floor(rand(i * 3.1) * STATUSES.length)]
    const hasCustomer = rand(i * 7.7) > 0.4
    const imported = s.code === '99-IMPORTED'
    claims.push({
      drNumber: String(dr + i),
      roNumber: rand(i * 2.3) > 0.5 ? String(dr + i) : '0',
      aging: Math.floor(rand(i * 5.5) * 21),
      dip: Math.floor(rand(i * 4.4) * 4),
      registration: plate(i + 1),
      status: s.code,
      manufacturer: MANUFACTURERS[Math.floor(rand(i * 9.2) * MANUFACTURERS.length)],
      csa: rand(i * 1.7) > 0.6 ? ['T. Ndlovu', 'K. Pillay', 'S. Botha'][Math.floor(rand(i * 1.3) * 3)] : 'None',
      insurer: imported
        ? (rand(i * 6.1) > 0.5 ? 'NONE' : 'N/A')
        : ['Santam', 'Discovery', 'OUTsurance', 'Hollard', 'N/A'][Math.floor(rand(i * 8.8) * 5)],
      approvedValue: imported ? 0 : Math.floor(rand(i * 3.9) * 85000),
      customer: hasCustomer
        ? `${FIRST[Math.floor(rand(i * 2.9) * FIRST.length)]} ${LAST[Math.floor(rand(i * 3.7) * LAST.length)]}`
        : '',
      contact: rand(i * 4.1) > 0.3
        ? '0' + String(Math.floor(rand(i * 6.6) * 900000000) + 100000000)
        : '0000000000',
      speedShop: rand(i * 5.2) > 0.85,
      td: rand(i * 7.3) > 0.5 ? 'T' : 'D',
      warranty: rand(i * 8.1) > 0.85,
      upsell: rand(i * 9.9) > 0.88,
    })
  }
  return claims
}

export const CLAIMS: Claim[] = generate()

export function claimsByStatus(code: string): Claim[] {
  return CLAIMS.filter((c) => c.status === code)
}

export function statusCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const s of STATUSES) counts[s.code] = 0
  for (const c of CLAIMS) counts[c.status] = (counts[c.status] ?? 0) + 1
  return counts
}

export const ZAR = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR',
  maximumFractionDigits: 0,
})
