import { useState, useEffect, useRef } from 'react';
import { FolderPlus } from 'lucide-react';
import { useFoldersStore } from '@/state/foldersStore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FolderDialog } from '@/components/sidebar/FolderDialog';
import { toast } from '@/state/toastStore';

interface FolderPickerProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

export function FolderPicker({ value, onChange }: FolderPickerProps) {
  const folders = useFoldersStore((s) => s.folders);
  const addFolder = useFoldersStore((s) => s.add);
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingCreate = useRef(false);

  useEffect(() => {
    if (value === '__create__') {
      pendingCreate.current = true;
      setDialogOpen(true);
    }
  }, [value]);

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && pendingCreate.current) {
      pendingCreate.current = false;
      onChange(undefined);
    }
  };

  const handleCreate = async (name: string, color: string) => {
    const folder = await addFolder(name, color);
    onChange(folder.id);
    toast({ message: 'Folder created', variant: 'info' });
  };

  return (
    <>
      <Select
        value={value ?? '__none__'}
        onValueChange={(v) => {
          if (v === '__create__') {
            setDialogOpen(true);
          } else {
            onChange(v === '__none__' ? undefined : v);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="No folder" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No folder</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: f.color }}
                />
                {f.name}
              </span>
            </SelectItem>
          ))}
          <SelectItem value="__create__" className="text-muted-foreground">
            <span className="flex items-center gap-2">
              <FolderPlus className="h-3.5 w-3.5" />
              New folder...
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <FolderDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        onSave={handleCreate}
      />
    </>
  );
}
