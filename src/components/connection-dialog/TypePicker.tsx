import { useState } from 'react'
import { ArrowRight, Search, X } from 'lucide-react'
import { CONNECTION_TYPES } from '@/data/connectionTypes'
import type { ConnectionType } from '@/types/connection'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

interface TypePickerProps {
  selected?: ConnectionType
  onSelect: (type: ConnectionType) => void
}

export function TypePicker({ selected, onSelect }: TypePickerProps) {
  const [search, setSearch] = useState('')

  const filtered = CONNECTION_TYPES.filter(
    (def) =>
      def.label.toLowerCase().includes(search.toLowerCase()) ||
      def.description.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connection types…"
          className="h-8 pl-8 pr-8 text-xs"
          autoFocus
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((def) => {
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
      ) : (
        <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
          No matching connections found.
        </div>
      )}
    </div>
  )
}
