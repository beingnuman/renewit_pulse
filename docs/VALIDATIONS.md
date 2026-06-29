# Renewit Pulse — Validations & Status Rules

A running reference for all validation rules, status transitions, and auto-transitions
in the app. Update this file whenever a new rule is added.

_Last updated: 2026-06-25_

---

## 1. Status transitions

### 1.1 Upsell jobs — status locked
- **Rule:** A claim whose `relationship` matches `/upsell/i` cannot change status manually.
- **Reason:** Upsell job status **follows the main job**.
- **UI:** The status dropdown (`StatusControl`) renders disabled — greyed out, lock
  icon instead of the chevron, and a hover/focus caption: _"Status follows the main job"_.
  The menu cannot open and no transition can be started.
- **Where:** `src/pages/ClaimDetail.tsx` — `StatusControl` receives
  `disabled={/upsell/i.test(claim.relationship)}` and `disabledReason`.
- **Status:** ✅ Implemented.

### 1.2 Drive-Quote Sent → Drive-Authorisation Received — requires approved values
- **Rule:** Moving a claim from **71-Drive-Quote Sent** to **71-Drive-Authorization Received**
  is blocked unless **both Approved Quote > 0 AND Approved Parts > 0**.
- **Missing-value message (names which is missing):**
  - Both missing → _"Approved Quote and Approved Parts values cannot be 0. Please import the Authorised quote into TMS."_
  - Quote only → _"Approved Quote value cannot be 0. Please import the Authorised quote into TMS."_
  - Parts only → _"Approved Parts value cannot be 0. Please import the Authorised quote into TMS."_
- **Source of truth:** The approved values come from the **external TMS Quote API**
  (`tmsphoenix.renew-it.co.za`), surfaced live by the `get-tms-financial-data` edge function
  and mirrored onto `claims.approved_quote` / `claims.approved_parts` and
  `claim_tms_financials.approved_quote_excl_vat` / `.approved_parts`.
- **Frontend:** `StatusControl` calls `validateTransition(current, target)` (in `ClaimDetail`)
  the moment the user picks the target status. It fetches live financial data; if a value is
  missing it shows the message inline in the dropdown (red) and never opens the confirm modal.
- **Backend (defense in depth):** `public.update_claim_status` raises the same message if the
  mirrored approved values are 0/empty. Because the frontend guard refreshes TMS data (which
  mirrors fresh values into the DB) *before* the update fires, the backend sees current values
  on the UI path. An API caller that skips the refresh will be blocked (safe / over-restrictive).
- **Where:** `src/pages/ClaimDetail.tsx` (`validateTransition`, `StatusControl`),
  migration `guard_drive_auth_requires_approved_values` on Supabase project `renewit-rivonia`.
- **Status:** ✅ Implemented (frontend + backend).

### 1.3 Parts Available - Contact Client → 100-Booked — requires CSA + booking & promise dates
- **Rule:** Moving a claim from **75-Parts Available - Contact Client** to **100-Booked**
  is blocked unless **all three** are present. The guard reports every missing item at once
  (one alert card per issue):
  - **CSA not assigned** → _"Please assign a CSA in the Job/Branch Details tab to proceed."_
  - **Booking Date empty** → _"Please select a booking date in the Key Dates tab to proceed."_
  - **Promise Date empty** → _"Please select a promise date in the Key Dates tab to proceed."_
- **Data checked:** CSA from `claim.assigned_staff.csa.name`; booking & promise dates from
  `getClaimEventDates(claim.claim_id)` (`claim_event_dates.booking_date` / `.promise_date`).
- **Frontend only:** Enforced in `validateTransition` (Rule B) in `ClaimDetail`; issues render
  as stacked alert cards inside the status dropdown and the confirm modal never opens.
  No backend guard for this rule (by request).
- **Where:** `src/pages/ClaimDetail.tsx` (`validateTransition`, `StatusControl`).
- **Status:** ✅ Implemented (frontend only).

### 1.4 "Not proceeding" statuses require a reason
- **Rule:** Moving to **any** status whose name contains "not proceeding" (e.g.
  **70-Tow-Client not proceeding**, **71-Drive-Client not proceeding**,
  **80-Upsell Not Proceeding**) requires picking a reason. The confirmation modal shows a
  **mandatory dropdown** of reasons; **Confirm change** is disabled until one is chosen.
- **Reasons source:** `getNotProceedingReasons()` → RPC `get_not_proceeding_reasons`
  (returns `{ id, reason }`).
- **Persistence:** on confirm, the reason is saved to the claim's
  `not_proceeding_reason` column via `setNotProceedingReason()` (calls
  `update_claim_job_staff_details` with **only** that key, so other job/staff fields are
  untouched). It therefore shows in the **Job/Branch Details** tab's "Reason for not
  proceeding" field. It's also passed as the status-change comment
  (`"Not proceeding: <reason>"`) for the event log. Reason is saved before the status change.
- **Where:** `StatusControl` confirm modal in `src/pages/ClaimDetail.tsx`;
  `setNotProceedingReason` in `src/lib/api.ts`.
- **Status:** ✅ Implemented (frontend; persists to Job/Branch field).

### 1.5 → 01-Converted — requires key fields populated
- **Rule:** Moving to **01-Converted** (from any status) is blocked unless **all** of these
  have values. Each missing field shows its own alert card titled "<Field> Missing" with
  _"Please ensure the following fields are completed: <Field>"_:
  - **Promise Days** (from `getClaimEventDates` → `promiseDays` > 0)
  - **Approved Parts** (financial > 0)
  - **Approved Quote** (financial > 0)
  - **Pre-Costing/Projected Parts Costs** (financial `precosting` > 0)
  - **RO Number** (`claim.ro_number`; blank or `"0"` counts as missing)
- **Where:** `validateTransition` (Rule C) + `StatusControl` in `src/pages/ClaimDetail.tsx`.
- **Frontend only.**
- **Status:** ✅ Implemented (frontend only).

### 1.6 Available transitions
- Manual transition options come from the backend via `getStatusTransitions(claimId, userId)`.
- A status change is committed through `updateClaimStatus(claimId, next, userId, userType)`
  after a confirmation modal.
- **Where:** `StatusControl` in `src/pages/ClaimDetail.tsx`.

---

## 2. Auto-transitions (backend-driven)

### 2.1 Upload a Drive Quote → "Drive-Quote Sent"
- **Rule:** When status is **71-Drive-Quote Required** and a user uploads a document in
  the **Uploads** tab, the backend automatically advances the status to
  **Drive-Quote Sent**.
- **Where the logic lives:** Backend (DB trigger / RPC). The frontend does **not** decide
  this — it only re-reads the new status.
- **Frontend behaviour:** After a successful upload, `UploadsTab` calls `onChanged()`, which
  refetches the claim so the header reflects the new status without a manual reload.
  Refetches for the same claim are **quiet** (no full-page loader flash).
- **Where:** `UploadsTab` + main claim fetch effect in `src/pages/ClaimDetail.tsx`.
- **Status:** ✅ Implemented (frontend refresh wired).

### 2.2 Upload a Moderation PDF → "01-Moderation"
- **Rule:** When status is **01-Preliminary Conversion** and a user uploads a PDF in the
  **Moderation** tab, the backend automatically advances the status to **01-Moderation**.
- **Where the logic lives:** Backend. The frontend only re-reads the new status.
- **Frontend behaviour:** `ModerationTab` calls `onChanged()` after a successful upload, then
  again after ~1.8s (the auto-transition can land just after the upload returns), so the header
  updates without a manual reload.
- **Dropdown hint:** While the claim is in **01-Preliminary Conversion**, opening the status
  dropdown shows an info banner: _"Upload a quote in the Moderation tab to initiate the
  moderation process."_ (informational only — not a block). `StatusControl` `hint` prop.
- **Where:** `ModerationTab` + `StatusControl` in `src/pages/ClaimDetail.tsx`.
- **Status:** ✅ Implemented (frontend refresh + hint).

> **Note:** Any backend auto-transition will surface correctly in the UI as long as the
> triggering action calls `onChanged()` / bumps `reloadKey` after it completes.

---

## 3. Upload validations (Uploads tab)

- **Max file size:** 25 MB (`UPLOAD_MAX = 25 * 1024 * 1024`). Larger files are rejected
  with a toast.
- **Document title:** required (trimmed, non-empty) before upload.
- **Category:** optional.
- **Accepted types (guidance):** PDF, Word, Excel, image.
- **Where:** `UploadsTab` in `src/pages/ClaimDetail.tsx`.

---

## 4. Customer & Vehicle Details — field validations

Validated on the Customer & Vehicle Details tab (`src/pages/ClaimDetail.tsx`). Errors only
surface after the user edits a field (`dirty`). Save is blocked until all pass.

| Field | Rule |
|---|---|
| Title (salutation) | Required |
| Firstname | Required; valid name (letters/spaces/`'.-`, no numbers) |
| Surname | Required; valid name (no numbers) |
| Email | Required; valid email format |
| Cell phone | Required; exactly 10 digits |
| Alternative phone | Optional; if present, exactly 10 digits |
| Make | Required |
| Model | Required |
| VIN | Required; exactly 17 chars, excludes I, O, Q |
| Registration | Required |

Regexes: name `^[A-Za-z][A-Za-z\s'.-]*$`, email `^[^\s@]+@[^\s@]+\.[^\s@]+$`,
VIN `^[A-HJ-NPR-Z0-9]{17}$`.

---

## 5. Role-based navigation visibility

Which top-nav tabs each role can see **and** open. Frontend-only: nav links are hidden
(`navAllowed` in `src/lib/permissions.ts`, used by `Layout`) and routes are guarded
(`RequireNav` in `App.tsx` redirects disallowed direct-URL hits to `/dashboard`).

Base set (all listed roles): **Dashboard, All Claims, Reports, Documents**.

| Role | + All Customers | + Calendar |
|---|:---:|:---:|
| Claims Handler | ✓ | ✓ |
| Estimator | — | ✓ |
| Conversion Clerk | — | ✓ |
| Moderator | — | ✓ |
| Parts Buyer | — | — |
| Floor Manager | — | ✓ |
| Auditor | — | ✓ |
| CSA | — | ✓ |
| Costing Clerk | — | ✓ |
| Financial Manager | ✓ | ✓ |
| Operations Director | ✓ | ✓ |

- **Admins** (`is_admin`) see every tab, including **Allocate CSA** and **Admin**.
- **Allocate CSA** stays gated by the existing CSA-allocation permission (`canAllocateCsa`).
- **Unknown / generic / null roles** (e.g. `user`, `agent`, `SYSTEM`) fall back to the
  **base set** only. _(Assumption — adjust in `navAllowed` if these should see more.)_
- DB role strings are inconsistent (`Claims Handler` / `claims_handler`, `CSA` / `csa`,
  `Parts Buyer`, `Operations Director`, …), so matching is keyword-normalised.
- Detail/utility routes (`/claim/:id`, `/search`, `/new-claim`, KPI/status views) are not
  nav-gated — any signed-in user can reach them.
- **Status:** ✅ Implemented (frontend nav + route guard).

---

## 6. Empty / "N/A" display rule

- Field values that resolve to `N/A` or `0` are shown muted + italic (visually de-emphasised)
  so populated data stands out. Display-only; not a blocking validation.
- **Where:** `Field` component + `.cd-field-value.is-na` in `src/App.css`.

---

## 7. New Claim — Insurance Quote details

- **Trigger:** On the New Claim form, choosing **Type of Quote = "Insurance Quote"** reveals an
  **Insurance Details** panel inside the "Client Repair Quote Details" card.
- **Fields:** Insurance Company (dropdown, `getInsurers`) — **required**; Broker (dropdown,
  `getBrokersByInsurance` by selected insurer), Insurance Claims Administrator, Insurance Policy
  Number, Insurance Claim Number — **optional** (saved if filled). Only Insurance Company blocks
  submission. If the chosen insurer has no brokers, the Broker field is disabled with a
  "No brokers found for this insurer." note below it.
- **Persistence:** after `create_new_estimate` returns the new claim, the form calls
  `updateClaimInsuranceDetails(claimId, …)` to save them. The claims-administrator field maps to
  `claims.insurer_agent` (added via `p_insurer_agent` on the `update_claim_insurance_details` RPC,
  migration `insurance_details_add_claims_administrator`). Broker is saved by its legacy id + name;
  insurer by its company uuid.
- **Where:** `src/pages/NewClaim.tsx`; `updateClaimInsuranceDetails` in `src/lib/api.ts`.
- **Status:** ✅ Implemented (frontend + backend).

---

## 8. User form — auto agent-type assignment

- Picking a **System role** in the Add/Edit User modal auto-selects that role's default
  agent types (`getAgentTypesForRole` → each type's `default_roles`).
- **Override:** selecting **Conversions Clerk** also auto-selects **Agent Type 4: Conversion**
  (matched by name, so it doesn't depend on the agent-type's UUID), even though that type has
  no `default_roles` tag in the backend. The user can still toggle types manually afterward.
- **Where:** `onRoleChange` in `src/components/AddUserModal.tsx`. Frontend only.
- **Status:** ✅ Implemented.

---

## 9. Speed Job & Targeted Priority (Overview tab)

- **Toggles:** The "Special Handling & Priority" card (Overview) wires Speed Job →
  `update_speedjob` (`claims.speed_indicator`) and Targeted Priority → `update_priority`
  (`claims.priority`/`priority_flag`). Enabling is immediate; **disabling asks for
  confirmation** ("This is a speed shop job. Are you sure you want to turn it off?").
- **5-day SLA banner:** When Speed Job is on, a banner (above the info panel) shows the
  5-day window. **Start = the claim's booking date** (`booked_date` / `timeline.date_booked`).
  Due = booking date + 5 days. Computed live in the browser (frontend only).
  - **On track → green**, shows "X Days Left".
  - **Overdue → red**, shows "X Days Overdue".
  - If there's no booking date, the banner shows "no booking date set".
  - **Log Delay** button opens a modal; the explanation is saved as a claim **Issue**
    (`createClaimIssue` → `manage_claim_issues`, severity High / type Production), which then
    shows on the Overview & Issues tabs.
- **Where:** `SpecialHandlingCard`, `SpeedJobBanner`, `LogDelayModal` in
  `src/pages/ClaimDetail.tsx`; `updateSpeedJob` / `updatePriority` in `src/lib/api.ts`.
- **Note:** the `claims.speed_indicator_set_at` column + `get_speed_job_sla` RPC (migration
  `speedjob_started_at_for_sla`) were added for an earlier "start on toggle" approach and are
  now unused (SLA uses booking date instead); left in place, harmless.
- **Status:** ✅ Implemented (frontend; SLA from booking date).

---

## Backlog / ideas (not yet implemented)

- Transition guards: block specific status moves unless required fields exist
  (e.g. cannot move to "Authorised" without an approved value / insurer).
- Role-based transition permissions (which user types may perform which transitions).
- Additional upload-triggered auto-transitions beyond Drive-Quote.
