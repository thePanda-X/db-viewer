import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, FolderOpen, Loader2 } from 'lucide-react';
import type { Connection, ConnectionType } from '@/types/connection';
import { getConnectionTypeDef } from '@/data/connectionTypes';
import { buildFlatFormSchema, type FlatFormValues } from '@/data/formSchema';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useState } from 'react';

interface ConnectionFormProps {
  type: ConnectionType;
  initialValues?: { name: string; config: Connection['config'] };
  onSubmit: (values: {
    name: string;
    config: Connection['config'];
  }) => Promise<void> | void;
  onBack?: () => void;
  submitLabel?: string;
}

export function ConnectionForm({
  type,
  initialValues,
  onSubmit,
  onBack,
  submitLabel = 'Save',
}: ConnectionFormProps) {
  const def = getConnectionTypeDef(type);
  const Icon = def.icon;
  const schema = buildFlatFormSchema(type);
  const [browsing, setBrowsing] = useState(false);

  const defaults: FlatFormValues = (() => {
    const base: FlatFormValues = { name: initialValues?.name ?? '' };
    const cfg = (initialValues?.config ??
      def.defaultConfig) as unknown as Record<string, unknown>;
    for (const field of def.fields) {
      if (field.name === 'name') continue;
      base[field.name] = (cfg[field.name] ?? field.defaultValue ?? '') as
        | string
        | number
        | boolean;
    }
    return base;
  })();

  const form = useForm<FlatFormValues>({
    resolver: zodResolver(schema) as Resolver<FlatFormValues>,
    defaultValues: defaults,
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    const config = { ...def.defaultConfig } as unknown as Record<
      string,
      unknown
    >;
    for (const field of def.fields) {
      if (field.name === 'name') continue;
      config[field.name] = values[field.name];
    }
    await onSubmit({
      name: values.name as string,
      config: config as unknown as Connection['config'],
    });
  });

  const handleBrowse = async (fieldName: string) => {
    setBrowsing(true);
    try {
      const path = await api.dialog.openFile({
        filters: def.fileDialogFilters,
      });
      if (path) {
        form.setValue(fieldName, path, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    } finally {
      setBrowsing(false);
    }
  };

  const wrapperClassFor = (field: (typeof def.fields)[number]) => {
    if (field.colSpan === 2) return 'col-span-2';
    if (field.type === 'switch') return 'col-span-2';
    return '';
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <Icon className={`h-4 w-4 ${def.brandColor}`} />
          <span className="text-sm font-medium">{def.label}</span>
          <span className="text-xs text-muted-foreground">
            — {def.description}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {def.fields.map((field) => {
            const isName = field.name === 'name';
            if (isName) {
              return (
                <div key={field.name} className={wrapperClassFor(field)}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>{field.label}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={field.placeholder}
                            autoFocus
                            {...f}
                            value={f.value as string}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              );
            }

            if (field.type === 'switch') {
              return (
                <div key={field.name} className={wrapperClassFor(field)}>
                  <FormField
                    control={form.control}
                    name={field.name}
                    render={({ field: f }) => (
                      <FormItem className="flex h-full flex-row items-center justify-between rounded-lg border border-border px-3 py-2.5">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">
                            {field.label}
                          </FormLabel>
                          {field.description && (
                            <FormDescription>
                              {field.description}
                            </FormDescription>
                          )}
                        </div>
                        <FormControl>
                          <Switch
                            checked={Boolean(f.value)}
                            onCheckedChange={f.onChange}
                            ref={f.ref}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              );
            }

            if (field.type === 'file') {
              return (
                <div key={field.name} className={wrapperClassFor(field)}>
                  <FormField
                    control={form.control}
                    name={field.name}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>{field.label}</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              placeholder={field.placeholder}
                              {...f}
                              value={f.value as string}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleBrowse(field.name)}
                            disabled={browsing}
                            aria-label="Browse for file"
                          >
                            {browsing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FolderOpen className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                        {field.description && (
                          <FormDescription>{field.description}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              );
            }

            const isNumber = field.type === 'number';
            return (
              <div key={field.name} className={wrapperClassFor(field)}>
                <FormField
                  control={form.control}
                  name={field.name}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormLabel>{field.label}</FormLabel>
                      <FormControl>
                        <Input
                          type={
                            isNumber
                              ? 'number'
                              : field.type === 'password'
                                ? 'password'
                                : 'text'
                          }
                          placeholder={field.placeholder}
                          autoComplete="off"
                          className={
                            isNumber
                              ? '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                              : undefined
                          }
                          {...f}
                          value={f.value as string | number}
                          onChange={(e) => {
                            if (isNumber) {
                              f.onChange(
                                e.target.value === ''
                                  ? ''
                                  : Number(e.target.value),
                              );
                            } else {
                              f.onChange(e.target.value);
                            }
                          }}
                        />
                      </FormControl>
                      {field.description && (
                        <FormDescription>{field.description}</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          {onBack ? (
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={form.formState.isSubmitting}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
