import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  listVehicleMakes,
  listVehicleModelsAdmin,
  createVehicleMake,
  updateVehicleMake,
  deleteVehicleMake,
  createVehicleModel,
  updateVehicleModel,
  deleteVehicleModel,
  type VehicleMakeRow,
  type VehicleModelRow,
} from '../lib/api'
import { Loader } from './Loader'
import { useToast } from './Toast'
import { IconSearch, IconPlus, IconEdit, IconCar } from './icons'

type ModalState =
  | { kind: 'make'; mode: 'add' | 'edit'; make?: VehicleMakeRow }
  | { kind: 'model'; mode: 'add' | 'edit'; make: string; model?: VehicleModelRow }
  | null

export function VehicleMakeModelPanel() {
  const toast = useToast()
  const [makes, setMakes] = useState<VehicleMakeRow[]>([])
  const [loadingMakes, setLoadingMakes] = useState(true)
  const [makeSearch, setMakeSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const [models, setModels] = useState<VehicleModelRow[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelSearch, setModelSearch] = useState('')

  const [modal, setModal] = useState<ModalState>(null)
  const [reloadMakes, setReloadMakes] = useState(0)
  const [reloadModels, setReloadModels] = useState(0)

  useEffect(() => {
    let on = true
    setLoadingMakes(true)
    listVehicleMakes()
      .then((d) => { if (on) setMakes(d) })
      .catch((e) => { if (on) toast(e instanceof Error ? e.message : 'Failed to load makes', 'error') })
      .finally(() => { if (on) setLoadingMakes(false) })
    return () => { on = false }
  }, [reloadMakes, toast])

  useEffect(() => {
    if (!selected) { setModels([]); return }
    let on = true
    setLoadingModels(true)
    listVehicleModelsAdmin(selected)
      .then((d) => { if (on) setModels(d) })
      .catch((e) => { if (on) toast(e instanceof Error ? e.message : 'Failed to load models', 'error') })
      .finally(() => { if (on) setLoadingModels(false) })
    return () => { on = false }
  }, [selected, reloadModels, toast])

  const filteredMakes = useMemo(() => {
    const q = makeSearch.trim().toLowerCase()
    return q ? makes.filter((m) => m.make.toLowerCase().includes(q)) : makes
  }, [makes, makeSearch])

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase()
    return q ? models.filter((m) => m.model.toLowerCase().includes(q)) : models
  }, [models, modelSearch])

  const onSaved = (kind: 'make' | 'model', renamedTo?: string) => {
    setModal(null)
    setReloadMakes((n) => n + 1)
    if (kind === 'model') setReloadModels((n) => n + 1)
    if (kind === 'make' && renamedTo && selected) setSelected(renamedTo)
  }

  return (
    <div className="vmm-grid">
      {/* Makes pane */}
      <section className="vmm-pane">
        <div className="vmm-pane-head">
          <div className="vmm-pane-title"><IconCar size={17} /> Makes <span className="vmm-count">{makes.length}</span></div>
          <button className="new-claim add-user-btn" onClick={() => setModal({ kind: 'make', mode: 'add' })}>
            <IconPlus size={15} /> Add Make
          </button>
        </div>
        <div className="search rm-search vmm-search">
          <span className="search-icon" aria-hidden><IconSearch size={16} /></span>
          <input placeholder="Search makes…" value={makeSearch} onChange={(e) => setMakeSearch(e.target.value)} />
        </div>
        {loadingMakes ? (
          <Loader label="Loading makes…" compact />
        ) : (
          <div className="vmm-list">
            {filteredMakes.length === 0 && <div className="vmm-empty">No makes found.</div>}
            {filteredMakes.map((m) => (
              <button
                key={m.make}
                className={`vmm-row${selected === m.make ? ' active' : ''}${m.is_active ? '' : ' off'}`}
                onClick={() => { setSelected(m.make); setModelSearch('') }}
              >
                <span className="vmm-row-name">{m.make}</span>
                <span className="vmm-row-meta">
                  <span className="vmm-models-badge">{m.model_count} model{m.model_count === 1 ? '' : 's'}</span>
                  {!m.is_active && <span className="pill-status off">Inactive</span>}
                  <span
                    className="vmm-edit"
                    role="button"
                    tabIndex={0}
                    title="Edit make"
                    onClick={(e) => { e.stopPropagation(); setModal({ kind: 'make', mode: 'edit', make: m }) }}
                  >
                    <IconEdit size={15} />
                  </span>
                  <span className="vmm-chev" aria-hidden>›</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Models pane */}
      <section className="vmm-pane">
        {selected ? (
          <>
            <div className="vmm-pane-head">
              <div className="vmm-pane-title vmm-models-title">
                <span className="vmm-models-for">Models for</span> <strong>{selected}</strong>
                <span className="vmm-count">{models.length}</span>
              </div>
              <button className="new-claim add-user-btn" onClick={() => setModal({ kind: 'model', mode: 'add', make: selected })}>
                <IconPlus size={15} /> Add Model
              </button>
            </div>
            <div className="search rm-search vmm-search">
              <span className="search-icon" aria-hidden><IconSearch size={16} /></span>
              <input placeholder={`Search ${selected} models…`} value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} />
            </div>
            {loadingModels ? (
              <Loader label="Loading models…" compact />
            ) : (
              <div className="vmm-list vmm-models">
                {filteredModels.length === 0 && <div className="vmm-empty">No models yet. Add one to get started.</div>}
                {filteredModels.map((m) => (
                  <div key={m.model} className={`vmm-row vmm-model-row${m.is_active ? '' : ' off'}`}>
                    <span className="vmm-row-name">{m.model}</span>
                    <span className="vmm-row-meta">
                      {!m.is_active && <span className="pill-status off">Inactive</span>}
                      <span
                        className="vmm-edit"
                        role="button"
                        tabIndex={0}
                        title="Edit model"
                        onClick={() => setModal({ kind: 'model', mode: 'edit', make: selected, model: m })}
                      >
                        <IconEdit size={15} />
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="vmm-placeholder">
            <span className="vmm-placeholder-ic"><IconCar size={30} /></span>
            <div className="vmm-placeholder-title">Select a make</div>
            <div className="vmm-placeholder-sub">Pick a make on the left to view and manage its models.</div>
          </div>
        )}
      </section>

      {modal && <VmmModal state={modal} onClose={() => setModal(null)} onSaved={onSaved} />}
    </div>
  )
}

function VmmModal({
  state,
  onClose,
  onSaved,
}: {
  state: Exclude<ModalState, null>
  onClose: () => void
  onSaved: (kind: 'make' | 'model', renamedTo?: string) => void
}) {
  const toast = useToast()
  const isMake = state.kind === 'make'
  const editing = state.mode === 'edit'
  const original = isMake ? (state.make?.make ?? '') : (state.model?.model ?? '')

  const [name, setName] = useState(original)
  const [isActive, setIsActive] = useState(
    isMake ? (state.make?.is_active ?? true) : (state.model?.is_active ?? true),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hard, setHard] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const label = isMake ? 'make' : 'model'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError(`${isMake ? 'Make' : 'Model'} name is required.`); return }
    setSubmitting(true)
    try {
      if (isMake) {
        if (editing) await updateVehicleMake(original, { name, isActive })
        else await createVehicleMake(name)
      } else {
        const make = (state as { make: string }).make
        if (editing) await updateVehicleModel(make, original, { name, isActive })
        else await createVehicleModel(make, name)
      }
      toast(editing ? `${isMake ? 'Make' : 'Model'} updated` : `${isMake ? 'Make' : 'Model'} added`, 'success')
      onSaved(state.kind, isMake ? name.trim() : undefined)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const doDelete = async () => {
    setDeleting(true)
    try {
      if (isMake) await deleteVehicleMake(original, hard)
      else await deleteVehicleModel((state as { make: string }).make, original, hard)
      toast(hard ? `${isMake ? 'Make' : 'Model'} deleted` : `${isMake ? 'Make' : 'Model'} deactivated`, 'success')
      onSaved(state.kind)
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const title = editing ? `Edit ${label}` : `Add ${label}`

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-sub">
              {!isMake && <>Under <strong>{(state as { make: string }).make}</strong>. </>}
              {editing ? 'Update the details below.' : `Create a new ${label}.`}
            </div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-grid">
            <label className="field span-2">
              <span>{isMake ? 'Make' : 'Model'} name *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </label>
            {editing && (
              <label className="field span-2">
                <span>Status</span>
                <select
                  className={`status-select ${isActive ? 'on' : 'off'}`}
                  value={isActive ? 'active' : 'inactive'}
                  onChange={(e) => setIsActive(e.target.value === 'active')}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (hidden from lists)</option>
                </select>
              </label>
            )}
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="modal-actions">
            {editing && (
              <button type="button" className="btn-delete" onClick={() => { setHard(false); setConfirmDelete(true) }}>
                Delete
              </button>
            )}
            <div className="modal-actions-right">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="new-claim" disabled={submitting}>
                {submitting ? 'Saving…' : editing ? 'Save changes' : `Add ${label}`}
              </button>
            </div>
          </div>
        </form>
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Delete {original}?</div>
            <div className="modal-body">
              <label className={`del-opt${!hard ? ' on' : ''}`}>
                <input type="radio" checked={!hard} onChange={() => setHard(false)} />
                <div>
                  <strong>Deactivate</strong>
                  <p>Hides it from the vehicle lists. Reversible.{isMake ? ' Also hides its models.' : ''}</p>
                </div>
              </label>
              <label className={`del-opt danger${hard ? ' on' : ''}`}>
                <input type="radio" checked={hard} onChange={() => setHard(true)} />
                <div>
                  <strong>Permanently delete</strong>
                  <p>Removes it for good.{isMake ? ' Deletes every model under this make.' : ''}</p>
                </div>
              </label>
            </div>
            <div className="modal-actions">
              <div className="modal-actions-right">
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
                <button className="btn-danger" onClick={doDelete} disabled={deleting}>
                  {deleting ? 'Working…' : hard ? 'Permanently delete' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
