import { useEffect, useRef } from 'react'
import { registerHotkey, type HotkeyEntry } from './registry'

export interface UseHotkeyOptions {
  label?: string
  group?: string
  description?: string
  allowInInputs?: boolean
  handler: (event: KeyboardEvent) => void
}

export function useHotkey(combo: string, options: UseHotkeyOptions): void {
  const handlerRef = useRef(options.handler)
  const labelRef = useRef(options.label)
  const groupRef = useRef(options.group)
  const descriptionRef = useRef(options.description)
  const allowInInputs = options.allowInInputs ?? false

  handlerRef.current = options.handler
  labelRef.current = options.label
  groupRef.current = options.group
  descriptionRef.current = options.description

  useEffect(() => {
    const unregister = registerHotkey({
      combo,
      label: labelRef.current,
      group: groupRef.current,
      description: descriptionRef.current,
      allowInInputs,
      handler: (event) => handlerRef.current(event),
    })
    return unregister
  }, [combo, allowInInputs])
}

export type { HotkeyEntry }
