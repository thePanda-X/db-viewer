import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { api } from '@/lib/api';
import type { RabbitMQConfig } from '@/types/connection';
import { toast } from '@/state/toastStore';
import { useHotkey } from '@/lib/hotkeys';

interface PublishMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  config: RabbitMQConfig;
  exchange: string;
}

export function PublishMessageDialog({
  open,
  onOpenChange,
  connectionId,
  config,
  exchange,
}: PublishMessageDialogProps) {
  const [routingKey, setRoutingKey] = useState('');
  const [body, setBody] = useState('');
  const [contentType, setContentType] = useState('text/plain');
  const [deliveryMode, setDeliveryMode] = useState<'1' | '2'>('1');
  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    if (!body) return;
    setPublishing(true);
    try {
      const res = await api.rabbitmq.publishMessage({
        connectionId,
        config,
        request: {
          exchange,
          routingKey,
          body,
          contentType,
          headers: {},
          deliveryMode: deliveryMode === '2' ? 2 : 1,
        },
      });
      if (!res.ok) {
        toast({
          message: 'Publish failed',
          detail: res.error,
          variant: 'error',
        });
        return;
      }
      toast({
        message: 'Message published',
        detail: `to exchange "${exchange}"`,
      });
      onOpenChange(false);
      setRoutingKey('');
      setBody('');
    } catch (err) {
      toast({
        message: 'Publish failed',
        detail: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setPublishing(false);
    }
  };

  useHotkey('Mod+Enter', {
    label: 'Publish message',
    group: 'RabbitMQ publish',
    description: 'Publish the message from the dialog',
    allowInInputs: true,
    handler: () => {
      if (open && body && !publishing) void handlePublish();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish Message</DialogTitle>
          <DialogDescription>
            Publish a message to exchange{' '}
            <span className="font-mono font-medium">{exchange}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="routingKey">Routing key</Label>
            <Input
              id="routingKey"
              value={routingKey}
              onChange={(e) => setRoutingKey(e.target.value)}
              placeholder="(empty)"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="body">Body</Label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder='{"hello": "world"}'
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="contentType">Content type</Label>
              <Input
                id="contentType"
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                placeholder="text/plain"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="deliveryMode">Delivery mode</Label>
              <select
                id="deliveryMode"
                value={deliveryMode}
                onChange={(e) => setDeliveryMode(e.target.value as '1' | '2')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="1">Non-persistent (1)</option>
                <option value="2">Persistent (2)</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishing}
          >
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={publishing || !body}>
            {publishing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1 h-3.5 w-3.5" />
            )}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
