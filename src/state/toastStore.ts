import { create } from 'zustand'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  message: string
  detail?: string
  variant: ToastVariant
}

interface ToastState {
  toasts: Toast[]
  push: (input: { message: string; detail?: string; variant?: ToastVariant; durationMs?: number }) => number
  dismiss: (id: number) => void
}

let counter = 0

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ message, detail, variant = 'info', durationMs = 2200 }) => {
    const id = ++counter
    set((s) => ({ toasts: [...s.toasts, { id, message, detail, variant }] }))
    if (durationMs > 0) {
      setTimeout(() => get().dismiss(id), durationMs)
    }
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function toast(input: { message: string; detail?: string; variant?: ToastVariant; durationMs?: number }): number {
  return useToastStore.getState().push(input)
}
