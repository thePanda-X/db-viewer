import { Database } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TabStrip } from './TabStrip'
import { TabContent } from './TabContent'
import { ConnectionDialog } from '@/components/connection-dialog/ConnectionDialog'

export function AppShell() {
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault()
        setDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-tight">db-vwr</span>
        </div>
      </header>
      <TabStrip />
      <main className="flex-1 overflow-hidden">
        <TabContent onCreateClick={() => setDialogOpen(true)} />
      </main>
      <ConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
