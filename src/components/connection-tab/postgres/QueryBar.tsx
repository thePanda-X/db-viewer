import { useCallback, useRef, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHotkey } from '@/lib/hotkeys'

interface QueryBarProps {
  database: string
  running: boolean
  onRun: (sql: string) => void
}

export function QueryBar({ database, running, onRun }: QueryBarProps) {
  const [sql, setSql] = useState<string>('SELECT now() AS server_time;')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const run = useCallback(() => {
    const trimmed = sql.trim()
    if (!trimmed) return
    onRun(trimmed)
  }, [sql, onRun])

  useHotkey('Mod+Enter', {
    label: 'Run query',
    group: 'Custom query',
    description: 'Execute the query in the custom query bar',
    allowInInputs: true,
    handler: () => {
      const target = document.activeElement as HTMLElement | null
      if (target?.tagName === 'TEXTAREA' && target === textareaRef.current) {
        run()
      }
    },
  })

  useHotkey('Mod+L', {
    label: 'Focus query bar',
    group: 'Custom query',
    description: 'Focus the custom query bar',
    handler: () => textareaRef.current?.focus(),
  })

  const disabled = running || !sql.trim()

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Custom query</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            read-only · {database}
          </span>
        </div>
        <Button size="sm" onClick={run} disabled={disabled} className="h-7">
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span>Run</span>
          <span className="ml-1 hidden font-mono text-[10px] opacity-70 sm:inline">⌘↵</span>
        </Button>
      </div>
      <textarea
        ref={textareaRef}
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        spellCheck={false}
        className="block w-full flex-1 resize-none bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none"
        placeholder="SELECT * FROM users LIMIT 50;"
      />
    </div>
  )
}
