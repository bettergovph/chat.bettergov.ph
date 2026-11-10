export class UpstreamError extends Error {
  constructor(public provider: string, public status: number) { super(`${provider} returned HTTP ${status}`); }
}
export async function readLimited(response: Pick<Response, "body" | "headers">, limit = 2_000_000, signal?: AbortSignal): Promise<string> {
  signal?.throwIfAborted();
  if (Number(response.headers.get("content-length")) > limit) { await response.body?.cancel(); throw new Error("Source response exceeds the size limit."); }
  if (!response.body) return "";
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let total = 0; let text = "";
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) { signal?.throwIfAborted(); const { value, done } = await reader.read(); signal?.throwIfAborted(); if (done) break; total += value.byteLength; if (total > limit) { await reader.cancel(); throw new Error("Source response exceeds the size limit."); } text += decoder.decode(value, { stream: true }); }
    return text + decoder.decode();
  } finally { signal?.removeEventListener("abort", cancel); reader.releaseLock(); }
}
export async function jsonFetch(url: string, init: RequestInit = {}, timeout = 20000): Promise<unknown> {
  const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
  // Workers supports manual/follow redirects only. Reject 3xx below so provider
  // credentials are never forwarded to a redirect destination in either runtime.
  const response = await fetch(url, { ...init, signal, cache: "no-store", redirect: "manual", headers: { "User-Agent": "KuyaJ/1.0 (Philippine civic research assistant)", "Accept": "application/json, text/event-stream", ...init.headers } });
  if (!response.ok) { await response.body?.cancel(); throw new UpstreamError(new URL(url).hostname, response.status); }
  const text = await readLimited(response, 2_000_000, signal);
  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const lines = text.split("\n").filter(line => line.startsWith("data:"));
    for (const line of lines.reverse()) { try { const data = JSON.parse(line.slice(5)); if (data.result || data.error) return data; } catch { /* Ignore protocol heartbeats. */ } }
    throw new Error("No JSON-RPC response in source stream.");
  }
  return JSON.parse(text);
}
export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
