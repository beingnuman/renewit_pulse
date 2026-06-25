import { useRef, useState, type DragEvent } from 'react'
import { uploadDocument, formatFileSize, DOC_TYPES } from '../lib/api'
import { useToast } from './Toast'
import { IconFilePdf, IconPlus } from './icons'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'
const MAX_BYTES = 25 * 1024 * 1024 // 25 MB

export function UploadDocs() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [docType, setDocType] = useState(DOC_TYPES[0].type)
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState('')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = (f: File | null) => {
    setError(null)
    if (f && f.size > MAX_BYTES) {
      setError('File is too large (max 25 MB).')
      return
    }
    setFile(f)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files?.[0] ?? null)
  }

  const upload = async () => {
    if (!file) {
      setError('Choose a file to upload.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      await uploadDocument({ docType, file, description })
      toast('Document uploaded', 'success')
      setFile(null)
      setDescription('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <div className="form-section-title">Upload a document</div>

      <div className="form-grid">
        <label className="field">
          <span>Document type *</span>
          <select value={docType} onChange={(e) => { setDocType(e.target.value); setError(null) }}>
            {DOC_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional note" />
        </label>
      </div>

      <div
        className={`upload-drop${dragging ? ' drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="upload-picked">
            <span className="doc-row-icon"><IconFilePdf size={20} /></span>
            <div>
              <div className="upload-picked-name">{file.name}</div>
              <div className="doc-row-meta">{formatFileSize(file.size)}</div>
            </div>
            <button
              type="button"
              className="btn-ghost sm"
              onClick={(e) => { e.stopPropagation(); pick(null); if (fileRef.current) fileRef.current.value = '' }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="upload-hint">
            <strong>Click to choose a file</strong> or drag &amp; drop it here
            <div className="muted">PDF, Word, Excel or image — up to 25 MB</div>
          </div>
        )}
      </div>

      {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="modal-actions" style={{ marginTop: 14 }}>
        <div className="modal-actions-right">
          <button className="new-claim" onClick={upload} disabled={uploading || !file}>
            <IconPlus size={16} /> {uploading ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      </div>
    </>
  )
}
