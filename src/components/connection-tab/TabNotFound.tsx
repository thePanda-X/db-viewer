import { AlertTriangle, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTabsStore } from '@/state/tabsStore'

interface TabNotFoundProps {
  tabId: string
}

export function TabNotFound({ tabId }: TabNotFoundProps) {
  const openHome = useTabsStore((s) => s.openHome)
  const closeTab = useTabsStore((s) => s.closeTab)

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight">Connection unavailable</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This connection was removed. Closing this tab will return to your connections list.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              closeTab(tabId)
              openHome()
            }}
          >
            Close tab
          </Button>
          <Button size="sm" onClick={openHome}>
            <Home className="mr-1 h-3.5 w-3.5" />
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
