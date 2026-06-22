import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TypePicker } from './TypePicker';
import { ConnectionForm } from './ConnectionForm';
import { useConnectionsStore } from '@/state/connectionsStore';
import { useTabsStore } from '@/state/tabsStore';
import type { Connection, ConnectionType } from '@/types/connection';
import { getConnectionTypeDef } from '@/data/connectionTypes';

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create' | 'edit';
  connection?: Connection;
}

type Step = 'pick' | 'form';

export function ConnectionDialog({
  open,
  onOpenChange,
  mode = 'create',
  connection,
}: ConnectionDialogProps) {
  const add = useConnectionsStore((s) => s.add);
  const update = useConnectionsStore((s) => s.update);
  const openConnection = useTabsStore((s) => s.openConnection);

  const [step, setStep] = useState<Step>(mode === 'edit' ? 'form' : 'pick');
  const [selectedType, setSelectedType] = useState<ConnectionType | undefined>(
    mode === 'edit' ? connection?.type : undefined,
  );

  useEffect(() => {
    if (open) {
      setStep(mode === 'edit' ? 'form' : 'pick');
      setSelectedType(mode === 'edit' ? connection?.type : undefined);
    }
  }, [open, mode, connection?.type]);

  const handleTypeSelect = (type: ConnectionType) => {
    setSelectedType(type);
    setStep('form');
  };

  const handleBack = () => {
    setStep('pick');
  };

  const handleCreate = async (values: {
    name: string;
    config: Connection['config'];
    folderId?: string;
  }) => {
    if (!selectedType) return;
    const created = await add(selectedType, values.name, values.config, values.folderId);
    onOpenChange(false);
    openConnection(created);
  };

  const handleUpdate = async (values: {
    name: string;
    config: Connection['config'];
    folderId?: string;
  }) => {
    if (!connection) return;
    await update(connection.id, {
      name: values.name,
      config: values.config,
      folderId: values.folderId,
    });
    onOpenChange(false);
  };

  const title =
    mode === 'edit'
      ? 'Edit connection'
      : step === 'pick'
        ? 'New connection'
        : 'Connection details';

  const description =
    mode === 'edit'
      ? `Editing ${connection?.name ?? 'connection'}.`
      : step === 'pick'
        ? 'Choose a connection type to get started.'
        : `Fill in the details to connect to your ${selectedType ? getConnectionTypeDef(selectedType).label : ''} instance.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === 'pick' && mode === 'create' ? (
          <TypePicker onSelect={handleTypeSelect} />
        ) : selectedType ? (
          <ConnectionForm
            type={selectedType}
            {...(mode === 'edit' && connection
              ? {
                  initialValues: {
                    name: connection.name,
                    config: connection.config,
                    folderId: connection.folderId,
                  },
                }
              : {
                  initialValues: {
                    name: '',
                    config: getConnectionTypeDef(selectedType)
                      .defaultConfig as unknown as Connection['config'],
                  },
                })}
            onSubmit={mode === 'edit' ? handleUpdate : handleCreate}
            {...(mode === 'create' ? { onBack: handleBack } : null)}
            submitLabel={mode === 'edit' ? 'Save changes' : 'Create connection'}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
