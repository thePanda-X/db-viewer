import { z } from 'zod';
import type { Folder } from './types/folder';

export const folderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}) satisfies z.ZodType<Folder>;

export const foldersSchema = z.array(folderSchema);

export function parseFolders(value: unknown): Folder[] {
  return foldersSchema.parse(value);
}
