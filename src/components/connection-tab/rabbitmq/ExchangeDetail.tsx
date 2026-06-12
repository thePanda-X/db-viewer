import { useCallback, useEffect, useState } from 'react'
import { GitCompare, Loader2, Send, Table2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import type { RabbitMQConfig } from '@/types/connection'
import type { RabbitMQBindingInfo, RabbitMQExchangeInfo } from '@/types/rabbitmq'
import { PublishMessageDialog } from './PublishMessageDialog'

interface ExchangeDetailProps {
  connectionId: string
  config: RabbitMQConfig
  exchange: RabbitMQExchangeInfo
}

export function ExchangeDetail({ connectionId, config, exchange }: ExchangeDetailProps) {
  const [bindings, setBindings] = useState<RabbitMQBindingInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.rabbitmq.listBindings({ connectionId, config, exchange: exchange.name })
      if (!res.ok) {
        setError(res.error)
        setBindings([])
      } else {
        setBindings(res.result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [connectionId, config, exchange.name])

  useEffect(() => { void load() }, [load])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-background px-3 text-xs">
        <GitCompare className="h-3.5 w-3.5 text-orange-500" />
        <span className="font-semibold tracking-tight">{exchange.name || '(AMQP default)'}</span>
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-mono">
          {exchange.type}
        </Badge>
        {exchange.durable && (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            durable
          </Badge>
        )}
        {exchange.internal && (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            internal
          </Badge>
        )}
        <Separator orientation="vertical" className="h-3" />
        <span className="text-muted-foreground">
          {exchange.messageStats
            ? `${exchange.messageStats.publishIn} in / ${exchange.messageStats.publishOut} out`
            : 'no stats'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setPublishOpen(true)}
          >
            <Send className="h-3 w-3" />
            Publish
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Bindings ({bindings.length})</span>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </div>
            ) : error ? (
              <div className="p-4 text-xs text-destructive">{error}</div>
            ) : bindings.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground">No bindings</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Destination</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Routing key</th>
                      <th className="px-3 py-2 text-left font-medium">Arguments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bindings.map((b, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2 font-mono">{b.destination}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="px-1 py-0 text-[10px]">
                            {b.destinationType}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{b.routingKey || '—'}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {Object.keys(b.arguments).length > 0 ? JSON.stringify(b.arguments) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <PublishMessageDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        connectionId={connectionId}
        config={config}
        exchange={exchange.name}
      />
    </div>
  )
}
