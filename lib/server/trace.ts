import type { TraceEvent, TraceInput } from "../trace.ts";

// Only explicitly selected operational fields are traced. This is a second
// boundary against accidentally echoing credentials in arguments or URLs.
export function redactTrace(value: unknown, secrets: string[], depth = 0): unknown {
  if (depth > 9) return "[omitted]";
  if (typeof value === "string") {
    let safe = value;
    for (const secret of secrets) if (secret) safe = safe.replaceAll(secret, "[redacted]");
    return safe.replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [redacted]").slice(0, 2500);
  }
  if (Array.isArray(value)) return value.slice(0, 80).map(item => redactTrace(item, secrets, depth + 1));
  if (typeof value === "object" && value !== null) return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [key, /^(authorization|cookie|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)$/i.test(key) ? "[redacted]" : redactTrace(item, secrets, depth + 1)]));
  return value;
}

export function createTrace(enabled: boolean, emit: (event: TraceEvent) => void) {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  const secrets = [process.env.LLM_API_KEY, process.env.ZAI_API_KEY, process.env.NYOLAB_API_KEY, process.env.TYPESAFE_API_KEY, process.env.MEILI_API_KEY].filter((key): key is string => Boolean(key));
  let sequence = 0;
  return (event: TraceInput) => {
    if (!enabled || sequence >= 200) return;
    emit(redactTrace({ type: "trace", requestId, sequence: ++sequence, elapsedMs: Date.now() - started, ...event }, secrets) as TraceEvent);
  };
}
