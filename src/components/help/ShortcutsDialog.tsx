import { Keyboard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCombo, listHotkeys } from '@/lib/hotkeys'

interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DisplayEntry {
  combo: string
  label: string
  description?: string
  group: string
}

interface GroupedSection {
  group: string
  items: DisplayEntry[]
}

function buildGrouped(): GroupedSection[] {
  const map = new Map<string, DisplayEntry[]>()
  for (const entry of listHotkeys()) {
    if (!entry.label) continue
    const display: DisplayEntry = {
      combo: entry.combo,
      label: entry.label,
      description: entry.description,
      group: entry.group ?? 'Other',
    }
    const list = map.get(display.group) ?? []
    list.push(display)
    map.set(display.group, list)
  }
  return Array.from(map.entries())
    .map(([group, items]) => ({
      group,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.group.localeCompare(b.group))
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  // Re-read whenever `open` changes so the cheatsheet reflects the active view
  const grouped = open ? buildGrouped() : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            All app shortcuts. Press <Kbd>?</Kbd> any time to open this dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No shortcuts registered.
            </p>
          ) : (
            grouped.map(({ group, items }) => (
              <section key={group} className="space-y-1.5">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </h3>
                <ul className="divide-y divide-border rounded-md border border-border bg-card">
                  {items.map((item) => (
                    <li
                      key={`${item.group}-${item.combo}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">{item.label}</div>
                        {item.description && (
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                      </div>
                      <Kbd>{formatCombo(item.combo)}</Kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted/50 px-1.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </kbd>
  )
}
