import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/state/toastStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type UpdateModalState =
  | {
      status: 'available';
      currentVersion: string;
      version: string;
    }
  | {
      status: 'downloading';
      version?: string;
    }
  | {
      status: 'downloaded';
      version: string;
    };

export function UpdateManager() {
  const [modal, setModal] = useState<UpdateModalState | null>(null);

  useEffect(() => {
    const handleStatus = (
      status: Awaited<ReturnType<typeof api.app.getUpdaterStatus>>,
    ) => {
      if (!status) return;

      switch (status.type) {
        case 'checking':
          if (status.manual) {
            toast({ message: 'Checking for updates...', durationMs: 1400 });
          }
          break;
        case 'available':
          setModal({
            status: 'available',
            currentVersion: status.currentVersion,
            version: status.version,
          });
          break;
        case 'not-available':
          if (status.manual) {
            toast({
              message: 'Everything is up to date.',
              detail: `You are running db-vwr ${status.currentVersion}.`,
              variant: 'success',
            });
          }
          break;
        case 'downloading':
          setModal((current) => ({
            status: 'downloading',
            version: status.version ?? current?.version,
          }));
          break;
        case 'downloaded':
          setModal({ status: 'downloaded', version: status.version });
          break;
        case 'error':
          toast({
            message: 'Update check failed.',
            detail: status.message,
            variant: 'error',
            durationMs: 5000,
          });
          setModal(null);
          break;
      }
    };

    void api.app.getUpdaterStatus().then(handleStatus);
    return window.api.updater.onStatus(handleStatus);
  }, []);

  const open = modal !== null;
  const version = modal?.version;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && setModal(null)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modal?.status === 'downloaded'
              ? 'Update Ready'
              : 'Update Available'}
          </DialogTitle>
          <DialogDescription>
            {modal?.status === 'available' &&
              `db-vwr ${modal.version} is available. You are currently running ${modal.currentVersion}.`}
            {modal?.status === 'downloading' &&
              `Downloading db-vwr ${version ?? 'update'}...`}
            {modal?.status === 'downloaded' &&
              `db-vwr ${modal.version} has been downloaded and is ready to install.`}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          {modal?.status === 'downloaded'
            ? 'Restart the app now to apply the update, or skip for now and install it later.'
            : 'You can update now or skip for now. Skipping will leave the current version running.'}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setModal(null)}
            disabled={modal?.status === 'downloading'}
          >
            Skip for now
          </Button>
          {modal?.status === 'downloaded' ? (
            <Button onClick={() => void api.app.installUpdate()}>
              <RefreshCw className="h-4 w-4" />
              Restart and install
            </Button>
          ) : (
            <Button
              onClick={() => void api.app.downloadUpdate()}
              disabled={modal?.status === 'downloading'}
            >
              <Download className="h-4 w-4" />
              {modal?.status === 'downloading'
                ? 'Downloading...'
                : 'Update now'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
