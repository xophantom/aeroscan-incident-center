import { createContext, useContext } from 'react'

export type ToastKind = 'error' | 'success'

export interface ToastApi {
  show(message: string, kind?: ToastKind): void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return toast
}
