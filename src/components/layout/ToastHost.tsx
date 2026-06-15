import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useToastStore,
  type Toast,
  type ToastVariant,
} from '@/state/toastStore';

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof Info; ring: string; iconClass: string }
> = {
  info: {
    icon: Info,
    ring: 'border-border bg-background',
    iconClass: 'text-muted-foreground',
  },
  success: {
    icon: CheckCircle2,
    ring: 'border-emerald-500/40 bg-background',
    iconClass: 'text-emerald-500',
  },
  warning: {
    icon: CircleAlert,
    ring: 'border-amber-500/40 bg-background',
    iconClass: 'text-amber-500',
  },
  error: {
    icon: CircleAlert,
    ring: 'border-destructive/50 bg-background',
    iconClass: 'text-destructive',
  },
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const { icon: Icon, ring, iconClass } = VARIANT_STYLES[toast.variant];
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-72 items-start gap-2 rounded-md border px-3 py-2 text-xs shadow-lg',
        'animate-in fade-in slide-in-from-bottom-2',
        ring,
      )}
    >
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', iconClass)} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-foreground">
          {toast.message}
        </div>
        {toast.detail && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {toast.detail}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-m-1 rounded-sm p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
