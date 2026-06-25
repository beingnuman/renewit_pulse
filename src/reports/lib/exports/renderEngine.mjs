// Spec-replay engine: rebuilds the SSRS workbook from template-spec.json using ExcelJS.
// Browser build — the spec is imported as JSON (Vite) instead of read from disk;
// all rendering logic below is identical to the server's renderEngine.
import specJson from './template-spec.json'

export const spec = specJson
const PALETTE = spec.indexedPalette || []

function resolveColor(c) {
  if (!c || typeof c !== 'object') return c
  if (c.argb) return { argb: c.argb }
  if (c.indexed != null) return { argb: PALETTE[c.indexed] || 'FF000000' }
  if (c.theme != null) return c // ExcelJS resolves themes
  return c
}
function fixFont(f) {
  if (!f) return f
  return { ...f, color: f.color ? resolveColor(f.color) : undefined }
}
function fixFill(f) {
  if (!f || f.type !== 'pattern') return f
  return { ...f, fgColor: resolveColor(f.fgColor), bgColor: resolveColor(f.bgColor) }
}
function fixBorder(b) {
  if (!b) return b
  const out = {}
  for (const side of ['top', 'left', 'bottom', 'right', 'diagonal']) {
    if (b[side]) out[side] = { ...b[side], color: resolveColor(b[side].color) }
  }
  if (b.diagonalUp != null) out.diagonalUp = b.diagonalUp
  if (b.diagonalDown != null) out.diagonalDown = b.diagonalDown
  return out
}
const DATE_FMT = /[ymd]/i
function coerceValue(value, numFmt) {
  if (typeof value === 'string' && numFmt && DATE_FMT.test(numFmt)) {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
  }
  return value
}

// Apply one captured cell descriptor onto an ExcelJS cell.
export function writeCell(cell, desc) {
  if (desc.rich) {
    cell.value = { richText: desc.rich.map((r) => ({ ...r, font: r.font ? fixFont(r.font) : undefined })) }
  } else if (desc.value !== null && desc.value !== undefined) {
    cell.value = coerceValue(desc.value, desc.numFmt)
  }
  if (desc.numFmt) cell.numFmt = desc.numFmt
  if (desc.font) cell.font = fixFont(desc.font)
  if (desc.fill) cell.fill = fixFill(desc.fill)
  if (desc.border) cell.border = fixBorder(desc.border)
  if (desc.alignment) cell.alignment = desc.alignment
}

// Build a worksheet from a sheet-spec, optionally overriding/extending cells.
export function buildSheet(wb, sheetSpec, { overrides = {}, skipRows = null, extraCells = null, extraMerges = null } = {}) {
  const ws = wb.addWorksheet(sheetSpec.name, { views: [{ showGridLines: false }] })
  // column widths
  sheetSpec.cols.forEach((w, i) => { if (w != null) ws.getColumn(i + 1).width = w })
  // cells
  for (const [addr, descRaw] of Object.entries(sheetSpec.cells)) {
    const rowNum = Number(addr.match(/\d+/)[0])
    if (skipRows && skipRows(rowNum)) continue
    const desc = overrides[addr] || descRaw
    writeCell(ws.getCell(addr), desc)
  }
  // extra (generated) cells
  if (extraCells) for (const [addr, desc] of Object.entries(extraCells)) writeCell(ws.getCell(addr), desc)
  // row heights
  for (const [rn, h] of Object.entries(sheetSpec.rowHeights)) {
    if (skipRows && skipRows(Number(rn))) continue
    ws.getRow(Number(rn)).height = h
  }
  // merges
  const merges = (sheetSpec.merges || []).filter((m) => {
    if (!skipRows) return true
    const r = Number(String(m).match(/\d+/)[0])
    return !skipRows(r)
  })
  for (const m of merges) { try { ws.mergeCells(m) } catch { /* overlap */ } }
  if (extraMerges) for (const m of extraMerges) { try { ws.mergeCells(m) } catch { /* overlap */ } }
  // page setup
  ws.pageSetup = {
    orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  }
  return ws
}

// Place the captured logo onto a sheet (Sheet1).
export function addLogo(wb, ws, sheetSpec) {
  if (!sheetSpec.images?.length || !spec.media?.length) return
  const media = spec.media[0]
  const id = wb.addImage({ base64: media.base64, extension: media.extension })
  for (const img of sheetSpec.images) {
    const r = img.range
    ws.addImage(id, { tl: { col: r.tl.col, row: r.tl.row }, br: { col: r.br.col, row: r.br.row }, editAs: 'oneCell' })
  }
}
