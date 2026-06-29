import { fetch as expoFetch } from 'expo/fetch';

/**
 * Streaming primitives shared by all providers.
 *
 * React Native's built-in fetch does not expose a readable body stream, so we
 * use `expo/fetch` (Expo SDK 52+) which returns a real ReadableStream. This
 * module turns that byte stream into parsed Server-Sent Events.
 */

export interface SSEvent {
  event?: string;
  data: string;
}

/**
 * Perform a streaming POST and yield decoded SSE events.
 * Centralises error handling so every provider gets consistent failures.
 */
export async function* postSSE(
  url: string,
  init: { headers: Record<string, string>; body: unknown },
  signal?: AbortSignal,
): AsyncGenerator<SSEvent> {
  const res = await expoFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...init.headers },
    body: JSON.stringify(init.body),
    signal: signal as AbortSignal | undefined,
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw new HttpError(res.status, text);
  }
  if (!res.body) {
    throw new HttpError(res.status, 'No response body to stream');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line.
      let sep: number;
      while ((sep = indexOfDelimiter(buffer)) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep).replace(/^(\r?\n){2}/, '');
        const parsed = parseEvent(rawEvent);
        if (parsed) yield parsed;
      }
    }
    // Flush any trailing event without a terminating blank line.
    const tail = parseEvent(buffer);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

/** A plain (non-SSE) streaming POST that yields raw text chunks. */
export async function* postRaw(
  url: string,
  init: { headers: Record<string, string>; body: unknown },
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await expoFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...init.headers },
    body: JSON.stringify(init.body),
    signal: signal as AbortSignal | undefined,
  });
  if (!res.ok) throw new HttpError(res.status, await safeText(res));
  if (!res.body) throw new HttpError(res.status, 'No response body to stream');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

function indexOfDelimiter(buf: string): number {
  const n = buf.indexOf('\n\n');
  const rn = buf.indexOf('\r\n\r\n');
  if (n === -1) return rn;
  if (rn === -1) return n;
  return Math.min(n, rn);
}

function parseEvent(raw: string): SSEvent | null {
  const lines = raw.split(/\r?\n/);
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith(':')) continue; // comment / keepalive
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0 && !event) return null;
  return { event, data: dataLines.join('\n') };
}

async function safeText(res: { text: () => Promise<string> }): Promise<string> {
  try {
    return (await res.text()).slice(0, 2000);
  } catch {
    return '';
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`HTTP ${status}: ${body || 'request failed'}`);
    this.name = 'HttpError';
  }
}
