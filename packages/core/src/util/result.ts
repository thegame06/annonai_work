import type { CoreError, ErrorCode, Result } from '../api.ts';

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T>(code: ErrorCode, message: string, resolveWith?: string): Result<T> => ({
  ok: false,
  error: resolveWith ? { code, message, resolveWith } : { code, message },
});
export const isErr = <T>(r: Result<T>): r is { ok: false; error: CoreError } => !r.ok;
