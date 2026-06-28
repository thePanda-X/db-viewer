import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseFolders } from '../shared/folderSchema';
import type { Folder } from '../shared/types/folder';

const FILE_VERSION = 1;

export interface FoldersFile {
  version: number;
  folders: Folder[];
}

let cache: FoldersFile | null = null;
let filePath: string | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function getFilePath(): string {
  if (filePath) return filePath;
  const dir = app.getPath('userData');
  filePath = path.join(dir, 'folders.json');
  return filePath;
}

async function readFromDisk(): Promise<FoldersFile> {
  const p = getFilePath();
  try {
    const raw = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(raw) as FoldersFile;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      parsed.version === FILE_VERSION &&
      Array.isArray(parsed.folders)
    ) {
      return {
        version: parsed.version,
        folders: parseFolders(parsed.folders),
      };
    }
    throw new Error('invalid shape');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const corruptPath = p.replace(/\.json$/, `.corrupt-${ts}.json`);
      try {
        await fs.rename(p, corruptPath);
        console.warn(
          `[folders] file was corrupt; moved to ${corruptPath} and starting fresh`,
        );
      } catch (renameErr) {
        console.error('[folders] failed to move corrupt file', renameErr);
      }
    }
    return { version: FILE_VERSION, folders: [] };
  }
}

async function writeToDisk(data: FoldersFile): Promise<void> {
  const p = getFilePath();
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, p);
  cache = data;
}

export async function listFolders(): Promise<Folder[]> {
  if (cache) return cache.folders;
  const data = await readFromDisk();
  cache = data;
  return data.folders;
}

export async function setFolders(folders: unknown[]): Promise<Folder[]> {
  const validFolders = parseFolders(folders);
  const data: FoldersFile = {
    version: FILE_VERSION,
    folders: validFolders,
  };
  writeQueue = writeQueue.then(
    () => writeToDisk(data),
    () => writeToDisk(data),
  );
  await writeQueue;
  return validFolders;
}
