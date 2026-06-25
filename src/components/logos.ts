// Official Renew-it brand logos (one per branch). Resolved at build time by Vite.
const FILES = import.meta.glob('../assets/FW_ Renew-it Logos/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// Map a clean logo-file basename -> url, keyed lowercased (e.g. "proline autobody").
const LOGOS: Record<string, string> = {}
for (const path in FILES) {
  const name = path.split('/').pop()!.replace(/\.png$/, '')
  LOGOS[name.toLowerCase()] = FILES[path]
}

// Explicit branch (name, lowercased) -> logo-file basename. Covers the branch
// naming that doesn't map 1:1 to a logo file.
const BRANCH_OVERRIDES: Record<string, string> = {
  'renew-it uat': 'group',
  'uat': 'group',
  'renew-it-proline': 'proline autobody',
  'proline': 'proline autobody',
  'renew-it-rivonia': 'rivonia',
  'renew-it-sandton': 'sandton',
  'renew-it-randburg': 'randburg',
  'renew-it-gs': 'greenstone',
  'renew-it-techno': 'technostar',
  'renew-it-truckrepaircentre': 'truck centre',
  'renew-it-tc': 'truck centre',
  'renew-it-umlhanga': 'umhlanga',
  'renew-it-pexpress': 'proline express',
  'renew-it-mexpress': 'proline carwash',
}

// Resolve a branch label (e.g. "renew-IT-Rivonia", "Renew-it UAT", "Group") to a logo url.
export function logoFor(branch?: string): string {
  if (branch) {
    const lc = branch.trim().toLowerCase()
    if (BRANCH_OVERRIDES[lc] && LOGOS[BRANCH_OVERRIDES[lc]]) return LOGOS[BRANCH_OVERRIDES[lc]]
    if (LOGOS[lc]) return LOGOS[lc]
    const token = lc.split('-').pop()!.trim()
    if (BRANCH_OVERRIDES[token] && LOGOS[BRANCH_OVERRIDES[token]]) return LOGOS[BRANCH_OVERRIDES[token]]
    if (LOGOS[token]) return LOGOS[token]
  }
  return LOGOS['group']
}
