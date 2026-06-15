import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseConnections } from '../shared/connectionSchema';
import type { Connection } from '../src/types/connection';

const FILE_VERSION = 1;

export interface ConnectionsFile {
  version: number;
  connections: Connection[];
}

let cache: ConnectionsFile | null = null;
let filePath: string | null = null;

function getFilePath(): string {
  if (filePath) return filePath;
  const dir = app.getPath('userData');
  filePath = path.join(dir, 'connections.json');
  return filePath;
}

async function readFromDisk(): Promise<ConnectionsFile> {
  const p = getFilePath();
  try {
    const raw = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(raw) as ConnectionsFile;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      parsed.version === FILE_VERSION &&
      Array.isArray(parsed.connections)
    ) {
      return {
        version: parsed.version,
        connections: parseConnections(parsed.connections),
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
          `[connections] file was corrupt; moved to ${corruptPath} and starting fresh`,
        );
      } catch (renameErr) {
        console.error('[connections] failed to move corrupt file', renameErr);
      }
    }
    return { version: FILE_VERSION, connections: [] };
  }
}

async function writeToDisk(data: ConnectionsFile): Promise<void> {
  const p = getFilePath();
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, p);
  cache = data;
}

export async function listConnections(): Promise<Connection[]> {
  if (cache) return cache.connections;
  const data = await readFromDisk();
  cache = data;
  return data.connections;
}

export async function setConnections(
  connections: unknown[],
): Promise<Connection[]> {
  const validConnections = parseConnections(connections);
  const data: ConnectionsFile = {
    version: FILE_VERSION,
    connections: validConnections,
  };
  await writeToDisk(data);
  return validConnections;
}
