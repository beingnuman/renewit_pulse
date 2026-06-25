import { type FuelSlip } from './api'
import { money } from './format'

const VOUCHER_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function voucherDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${VOUCHER_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

// Opens a print-ready fuel voucher in a new window.
export function printVoucher(slip: FuelSlip) {
  const esc = (s: string | null) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  const amount = slip.amount != null ? money(slip.amount) : 'R 0,00'
  const w = window.open('', '_blank', 'width=520,height=720')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Fuel Voucher ${esc(slip.refNumber)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:28px;color:#1f2733}
    .v{max-width:440px;margin:0 auto;border:2px solid #1b3a6b;border-radius:14px;overflow:hidden}
    .v-head{background:#1b3a6b;color:#fff;padding:18px 22px;text-align:center}
    .v-head h1{margin:0;font-size:20px;letter-spacing:1px}
    .v-head .sub{font-size:12px;opacity:.85;margin-top:3px}
    .v-body{padding:20px 22px}
    .row{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px dashed #d8e0ec;font-size:14px}
    .row .k{color:#64748b;font-weight:600}
    .row .val{font-weight:700;text-align:right}
    .v-amt{margin-top:16px;background:#eef2fb;border:1px solid #dbe4f5;border-radius:10px;padding:14px;text-align:center}
    .v-amt .lbl{font-size:11px;color:#64748b;letter-spacing:1px;font-weight:700}
    .v-amt .amt{font-size:28px;font-weight:800;color:#1b3a6b;margin-top:4px}
    ${slip.isVoided ? '.void-stamp{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font-size:64px;font-weight:900;color:rgba(176,8,48,.25);border:6px solid rgba(176,8,48,.25);padding:6px 24px;border-radius:12px}' : ''}
  </style></head><body>
  ${slip.isVoided ? '<div class="void-stamp">VOIDED</div>' : ''}
  <div class="v">
    <div class="v-head"><h1>FUEL VOUCHER</h1><div class="sub">Renew-it Group</div></div>
    <div class="v-body">
      <div class="row"><span class="k">REF NO</span><span class="val">${esc(slip.refNumber)}</span></div>
      <div class="row"><span class="k">Date Issued</span><span class="val">${voucherDate(slip.issueDate)}</span></div>
      <div class="row"><span class="k">Expiry Date</span><span class="val">${voucherDate(slip.expiryDate)}</span></div>
      <div class="row"><span class="k">Supply To</span><span class="val">${esc(slip.recipientName)}</span></div>
      <div class="row"><span class="k">For Vehicle</span><span class="val">${esc(slip.vehicleReg)}</span></div>
      <div class="v-amt"><div class="lbl">VALUE</div><div class="amt">${amount}</div></div>
    </div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
  </body></html>`)
  w.document.close()
}
