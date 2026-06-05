import { useEffect } from 'react'
import { dispatchHotkey } from './registry'

export function HotkeyProvider(): null {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => dispatchHotkey(event)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  return null
}
