import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS, parseSettings } from '../shared/settingsSchema';
import type { Settings } from '../shared/types/settings';

const FILE_VERSION = 1;

export interface SettingsFile {
  version: number;
  settings: Settings;
}

let cache: SettingsFile | null = null;
let filePath: string | null = null;

function getFilePath(): string {
  if (filePath) return filePath;
  const dir = app.getPath('userData');
  filePath = path.join(dir, 'settings.json');
  return filePath;
}

async function readFromDisk(): Promise<SettingsFile> {
  const p = getFilePath();
  try {
    const raw = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(raw) as SettingsFile;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      parsed.version === FILE_VERSION &&
      typeof parsed.settings === 'object' &&
      parsed.settings !== null
    ) {
      return {
        version: parsed.version,
        settings: parseSettings(parsed.settings),
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
          `[settings] file was corrupt; moved to ${corruptPath} and starting fresh`,
        );
      } catch (renameErr) {
        console.error('[settings] failed to move corrupt file', renameErr);
      }
    }
    return { version: FILE_VERSION, settings: DEFAULT_SETTINGS };
  }
}

async function writeToDisk(data: SettingsFile): Promise<void> {
  const p = getFilePath();
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, p);
  cache = data;
}

export async function getSettings(): Promise<Settings> {
  if (cache) return cache.settings;
  const data = await readFromDisk();
  cache = data;
  return data.settings;
}

export async function setSettings(settings: unknown): Promise<Settings> {
  const validSettings = parseSettings(settings);
  const data: SettingsFile = {
    version: FILE_VERSION,
    settings: validSettings,
  };
  await writeToDisk(data);
  return validSettings;
}
