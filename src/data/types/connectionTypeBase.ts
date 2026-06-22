import type { z } from 'zod';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Connection, ConnectionType } from '@/types/connection';
import type { Tab } from '@/types/tab';

export type FieldType = 'text' | 'password' | 'number' | 'switch' | 'file';

export interface FieldDefinition {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  description?: string;
  required?: boolean;
  min?: number;
  max?: number;
  /** How many grid columns the field spans (1 = half, 2 = full). Defaults to 1. */
  colSpan?: 1 | 2;
}

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

export interface ConnectionTypeDefinition<CConfig> {
  id: ConnectionType;
  label: string;
  description: string;
  icon: LucideIcon;
  brandColor: string;
  defaultConfig: CConfig;
  fields: FieldDefinition[];
  /** Per-type zod schema for the config object */
  schema: z.ZodType<CConfig>;
  /** Per-type zod schema for the whole connection (name + config) */
  fullSchema: z.ZodTypeAny;
  /** A short subtitle for cards, given the config */
  subtitle: (config: CConfig) => string;
  /** Renderer for an open connection tab. */
  TabComponent: ComponentType<{ connection: Connection; tab: Tab }>;
  fileDialogFilters?: FileDialogFilter[];
}
