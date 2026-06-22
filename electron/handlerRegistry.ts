import { ipcMain } from 'electron';

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Unknown error';
  }
}

export type IpcHandler<TArgs, TResult> = (
  args: TArgs,
) => Promise<TResult> | TResult;

export type ErrorMode =
  | 'raw'
  | 'okResult'
  | 'okKey'
  | 'okOnly'
  | 'errorPayload';

/**
 * Wraps a handler with consistent error handling.
 *
 * - `'raw'`: Returns the handler result as-is. The handler must produce its
 *   own error shapes (e.g. `{ ok: false, error }`).
 * - `'okResult'`: Returns `{ ok: true, result }` or `{ ok: false, error }`.
 * - `'okKey'`: Same as okResult but allows a custom key name.
 * - `'okOnly'`: Returns `{ ok: true }` or `{ ok: false, error }`.
 * - `'errorPayload'`: Returns the handler result or `{ error: string }`.
 */
async function wrapWithErrorMode<TArgs, TResult>(
  handler: IpcHandler<TArgs, TResult>,
  args: TArgs,
  errorMode: ErrorMode,
  okKey?: string,
): Promise<unknown> {
  try {
    const result = await handler(args);
    switch (errorMode) {
      case 'raw':
        return result;
      case 'okResult':
        return { ok: true as const, result };
      case 'okKey':
        return { ok: true as const, [okKey ?? 'result']: result };
      case 'okOnly':
        return { ok: true as const };
      case 'errorPayload':
        return result;
    }
  } catch (err) {
    const error = errorMessage(err);
    switch (errorMode) {
      case 'raw':
        throw err;
      case 'okResult':
        return { ok: false as const, error };
      case 'okKey':
        return { ok: false as const, error };
      case 'okOnly':
        return { ok: false as const, error };
      case 'errorPayload':
        return { error };
    }
  }
}

export interface RegisterOptions<TArgs, TResult> {
  channel: string;
  handler: IpcHandler<TArgs, TResult>;
  /** How the handler's result/error should be shaped. Default: `'raw'`. */
  errorMode?: ErrorMode;
  /** Key name for `'okKey'` error mode. Defaults to `'result'`. */
  okKey?: string;
}

/**
 * Register a single IPC handler with automatic error wrapping.
 */
export function registerHandler<TArgs, TResult>(
  options: RegisterOptions<TArgs, TResult>,
): void {
  const { channel, handler, errorMode = 'raw', okKey } = options;
  ipcMain.handle(channel, async (_event, args: TArgs) =>
    wrapWithErrorMode(handler, args, errorMode, okKey),
  );
}

/**
 * Register multiple IPC handlers at once.
 */
export function registerHandlers(
  handlers: RegisterOptions<unknown, unknown>[],
): void {
  for (const h of handlers) {
    registerHandler(h);
  }
}
