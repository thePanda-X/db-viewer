import { ArrowRight } from 'lucide-react'
import { CONNECTION_TYPES } from '@/data/connectionTypes'
import type { ConnectionType } from '@/types/connection'
import { cn } from '@/lib/utils'

interface TypePickerProps {
  selected?: ConnectionType
  onSelect: (type: ConnectionType) => void
}

export function TypePicker({ selected, onSelect }: TypePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {CONNECTION_TYPES.map((def) => {
        const Icon = def.icon
        const isSelected = selected === def.id
        return (
          <button
            type="button"
            key={def.id}
            onClick={() => onSelect(def.id)}
            className={cn(
              'group flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors',
              'hover:border-foreground/30 hover:bg-accent/40',
              isSelected && 'border-foreground/50 ring-1 ring-foreground/20',
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className={`h-5 w-5 ${def.brandColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold tracking-tight">{def.label}</div>
              <div className="truncate text-xs text-muted-foreground">{def.description}</div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
          </button>
        )
      })}
    </div>
  )
}
