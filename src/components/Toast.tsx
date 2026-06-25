import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastType = 'info' | 'success' | 'error'
interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const ToastCtx = createContext<(message: string, type?: ToastType) => void>(() => {})

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastCtx)
}

const ICON: Record<ToastType, string> = { info: 'ⓘ', success: '✓', error: '✕' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++idRef.current
    setItems((s) => [...s, { id, message, type }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4500)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toaster">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role="status">
            <span className="toast-icon">{ICON[t.type]}</span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-x" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Dismiss">✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
