/**
 * Retry helper for transient Supabase/network failures — dropped connections,
 * timeouts, 5xx/429 responses. Logical failures (RLS denials, check/unique
 * constraint violations, not-found) are never retried; they're rethrown
 * immediately so callers can react instead of retrying something that will
 * never succeed.
 */

type RetryableError = { code?: string; status?: number; message?: string };

// Postgres error codes worth retrying: query timeout, connection exhaustion/drop.
const RETRYABLE_PG_CODES = new Set(['57014', '53300', '08006', '08003', '08000']);

export function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError) return true; // fetch's own "Network request failed"
  const err = error as RetryableError;
  if (typeof err?.status === 'number' && (err.status === 429 || err.status >= 500)) return true;
  if (typeof err?.code === 'string' && RETRYABLE_PG_CODES.has(err.code)) return true;
  const message = err?.message?.toLowerCase() ?? '';
  return message.includes('network') || message.includes('timeout') || message.includes('fetch failed');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
};

/** Retries `fn` with exponential backoff + jitter, only for errors `shouldRetry` accepts (default: transient network/server errors). */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 400;
  const shouldRetry = opts.shouldRetry ?? isTransientError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!shouldRetry(error) || attempt === attempts - 1) throw error;
      await sleep(baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs);
    }
  }
  // Unreachable — the loop always returns or throws — but keeps TS satisfied.
  throw new Error('withRetry: exhausted attempts');
}
