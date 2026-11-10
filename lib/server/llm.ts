import { readLimited, UpstreamError, isRecord } from "./http.ts";
import { readSseData } from "../sse.ts";
import { getLlmConfig, getFallbackLlmConfig, type LlmConfig } from "./llm-config.ts";
import { ProviderResponseError, ProviderHealth, providerHealth, failoverReason, type FailureReason } from "./provider-health.ts";
import type { Tool } from "./tools.ts";
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type LlmMessage = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
export type CompletionObserver = {
  onContent: (content: string) => void;
  onTransport?: (mode: "streaming" | "buffered", reason?: string) => void;
};
export type ProviderEvent = {
  action: "request" | "completed" | "failed" | "fallback" | "skipped";
  provider: string; model: string; endpoint: string;
  reason?: FailureReason; httpStatus?: number; durationMs?: number; stream?: boolean;
  fromProvider?: string; retryAfterMs?: number;
};
type ProviderNotice = (event: ProviderEvent) => void;
const identity = (config: LlmConfig) => ({ provider: config.provider, model: config.model, endpoint: `${config.baseUrl}/chat/completions` });
function checkedMessage(content: unknown, toolCalls: unknown, finishReason: unknown) {
  if (finishReason === "length") throw new Error("The AI response exceeded its limit. Please ask a narrower question.");
  if (finishReason === "content_filter") throw new Error("The AI provider could not complete this response.");
  const calls = Array.isArray(toolCalls) ? toolCalls as ToolCall[] : [];
  if (calls.length > 8 || calls.some(c => !c || typeof c.id !== "string" || !c.id || c.type !== "function" || !c.function || typeof c.function.name !== "string" || !c.function.name || typeof c.function.arguments !== "string" || c.function.arguments.length > 18000)) throw new Error("The AI provider returned an invalid tool call.");
  return { role: "assistant" as const, content: typeof content === "string" ? content : null, ...(calls.length ? { tool_calls: calls } : {}) };
}
async function streamedMessage(response: Response, signal: AbortSignal, observer: CompletionObserver) {
  if (!response.body) throw new Error("The AI response stream is unavailable.");
  let content = "", finishReason: string | null = null;
  const calls = new Map<number, ToolCall>();
  for await (const data of readSseData(response.body, signal)) {
    if (data === "[DONE]") break;
    let event: unknown;
    try { event = JSON.parse(data); }
    catch { throw new ProviderResponseError("invalid_response", "The AI provider returned an invalid response."); }
    if (!isRecord(event) || event.error) throw new Error("The AI response stream failed.");
    if (!Array.isArray(event.choices) || !event.choices.length) continue; // usage-only event
    const choice = event.choices.find(c => isRecord(c) && (c.index === 0 || c.index === undefined));
    if (!isRecord(choice)) continue;
    const delta = isRecord(choice.delta) ? choice.delta : {};
    if (delta.refusal) throw new Error("The AI provider could not complete this response.");
    // Never emit or retain reasoning_content or other private provider fields.
    if (Array.isArray(delta.tool_calls) && delta.tool_calls.length) {
      if (!calls.size) observer.onContent(""); // Discard any preamble before a tool round.
      delta.tool_calls.forEach((fragment, position) => {
        if (!isRecord(fragment)) throw new Error("Invalid streamed tool call.");
        const index = fragment.index ?? position;
        if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= 8) throw new Error("Invalid streamed tool index.");
        const call = calls.get(index) ?? { id: "", type: "function" as const, function: { name: "", arguments: "" } };
        if (typeof fragment.id === "string") call.id = fragment.id;
        if (fragment.type !== undefined && fragment.type !== "function") throw new Error("Invalid streamed tool type.");
        if (isRecord(fragment.function)) {
          if (typeof fragment.function.name === "string") call.function.name += fragment.function.name;
          if (typeof fragment.function.arguments === "string") call.function.arguments += fragment.function.arguments;
        }
        if (call.function.arguments.length > 18000 || call.function.name.length > 200 || call.id.length > 200) throw new Error("Streamed tool call exceeded its size limit.");
        calls.set(index, call);
      });
    }
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      if (!calls.size) observer.onContent(content);
    }
    if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
  }
  if (!finishReason) throw new ProviderResponseError("interrupted_stream", "The AI response stream was interrupted.");
  return checkedMessage(content, [...calls.entries()].sort(([a], [b]) => a - b).map(([, call]) => call), finishReason);
}

async function completeWithProvider(config: LlmConfig, messages: LlmMessage[], tools: Tool[], signal: AbortSignal, forceLookup: boolean, observer: CompletionObserver | undefined, notice: ProviderNotice | undefined, firstOutputMs: number) {
  const { apiKey: key, baseUrl: base, model, reasoningEffort } = config;
  const usesGlmContract = config.provider === "zai" || (config.provider === "nyolab" && model.startsWith("glm-5.3"));
  // Preserve GLM's automatic tool selection through the Nyolab router too.
  // The route separately refuses
  // factual answers without accepted source evidence, even if the model skips tools.
  const requestMessages: LlmMessage[] = usesGlmContract && forceLookup && tools.length ? [
    { role: "system", content: "This research step requires a source lookup. Call an available lookup tool before giving a factual answer." }, ...messages,
  ] : messages;
  const payload = { model, messages: requestMessages, max_tokens: 5000, temperature: 0.2, ...(usesGlmContract && model.startsWith("glm-5.3") ? { reasoning_effort: reasoningEffort, thinking: { type: "enabled", clear_thinking: true } } : {}), ...(tools.length ? { tools: tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })), tool_choice: !usesGlmContract && forceLookup ? "required" : "auto" } : {}) };
  const firstOutput = new AbortController();
  const timer = setTimeout(() => firstOutput.abort(), firstOutputMs);
  const requestSignal = AbortSignal.any([signal, firstOutput.signal, AbortSignal.timeout(65000)]);
  const streamingObserver = observer ? { ...observer, onContent(content: string) { if (content) clearTimeout(timer); observer.onContent(content); } } : undefined;
  const request = async (stream: boolean) => {
    requestSignal.throwIfAborted();
    notice?.({ action: "request", ...identity(config), stream });
    try { return await fetch(`${base}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, Accept: "text/event-stream, application/json" }, signal: requestSignal,
      redirect: "manual", cache: "no-store", body: JSON.stringify({ ...payload, stream }),
    }); } catch (error) {
      if (!requestSignal.aborted && error instanceof TypeError) throw new ProviderResponseError("network_error", "The AI provider connection failed.");
      throw error;
    }
  };
  try {
  const streaming = Boolean(observer) && config.streaming;
  let response = await request(streaming);
  if (streaming && [400, 422].includes(response.status)) {
    const rejection = await readLimited(response, 16000);
    // Retry only an explicit capability rejection, before any output was emitted.
    if (/stream/i.test(rejection) && /not support|unsupported|not allowed|must[^.]*false|not available/i.test(rejection)) response = await request(false);
    else throw new UpstreamError(new URL(base).hostname, response.status);
  }
  if (!response.ok) { await response.body?.cancel(); throw new UpstreamError(new URL(base).hostname, response.status); }
  if (streaming && response.headers.get("content-type")?.includes("text/event-stream")) {
    observer!.onTransport?.("streaming");
    const answer = await streamedMessage(response, requestSignal, streamingObserver!);
    if (answer.content?.trim() || answer.tool_calls?.length) return answer;
    // Nyolab can end a tool-continuation stream with only a finish marker.
    // Retry once as JSON, only after a clean, entirely empty completion. Never
    // retry partial answers, interrupted streams, malformed calls or other errors.
    if (config.provider !== "nyolab") throw new ProviderResponseError("empty_response", "The AI provider returned an empty response.");
    observer!.onTransport?.("buffered", "Nyolab returned an empty stream; retrying once without streaming");
    response = await request(false);
    if (!response.ok) { await response.body?.cancel(); throw new UpstreamError(new URL(base).hostname, response.status); }
  }
  observer?.onTransport?.("buffered", streaming ? "Provider returned a complete response" : "Streaming disabled");
  let data: unknown;
  const body = await readLimited(response, 2_000_000, requestSignal);
  try { data = JSON.parse(body); }
  catch { throw new ProviderResponseError("invalid_response", "The AI provider returned an invalid response."); }
  // A provider may encode a refusal in a successful HTTP response. Never use
  // the backup to work around an explicit provider refusal or untyped error.
  if (isRecord(data) && data.error) throw new Error("The AI provider could not complete this response.");
  if (!isRecord(data) || !Array.isArray(data.choices) || !isRecord(data.choices[0])) throw new ProviderResponseError("invalid_response", "The AI provider returned an invalid response.");
  const choice = data.choices[0]; const message = choice.message;
  if (!isRecord(message)) throw new ProviderResponseError("invalid_response", "The AI provider returned no message.");
  if (message.refusal) throw new Error("The AI provider could not complete this response.");
  const answer = checkedMessage(message.content, message.tool_calls, choice.finish_reason);
  if (!answer.content?.trim() && !answer.tool_calls?.length) throw new ProviderResponseError("empty_response", "The AI provider returned an empty response.");
  if (!answer.tool_calls?.length && answer.content) observer?.onContent(answer.content);
  return answer;
  } catch (error) {
    if (!signal.aborted && requestSignal.aborted) throw new ProviderResponseError("timeout", "The AI provider took too long to respond.");
    throw error;
  } finally { clearTimeout(timer); }
}

export function createCompletionSession(options: { primary?: LlmConfig; fallback?: LlmConfig; onProviderEvent?: ProviderNotice; health?: ProviderHealth; firstOutputMs?: number } = {}) {
  const primary = options.primary ?? getLlmConfig();
  const fallback = options.fallback ?? getFallbackLlmConfig(primary);
  const health = options.health ?? providerHealth;
  const notice = options.onProviderEvent;
  let current = primary;
  let exposedAnswer = false;
  const changeProvider = (reason: FailureReason) => {
    const fromProvider = current.provider;
    current = fallback!;
    notice?.({ action: "fallback", ...identity(current), fromProvider, reason });
  };
  return {
    get provider() { return identity(current); },
    async complete(messages: LlmMessage[], tools: Tool[], signal: AbortSignal, forceLookup = false, observer?: CompletionObserver) {
      for (let attempt = 0; attempt < 2; attempt++) {
        signal.throwIfAborted();
        const canSwitch = Boolean(fallback && current === primary && !exposedAnswer);
        const availability = fallback ? health.acquire(current) : undefined;
        if (availability && !("lease" in availability)) {
          notice?.({ action: "skipped", ...identity(current), ...availability });
          if (canSwitch) { changeProvider(availability.reason); continue; }
          throw new ProviderResponseError("provider_unavailable", "The AI services are temporarily unavailable. Please try again shortly.");
        }
        const lease = availability?.lease;
        const start = Date.now();
        const tracked = observer ? { ...observer, onContent(content: string) { if (content) exposedAnswer = true; observer.onContent(content); } } : undefined;
        try {
          const backupReady = canSwitch && health.canAttempt(fallback!);
          const answer = await completeWithProvider(current, messages, tools, signal, forceLookup, tracked, notice, backupReady ? options.firstOutputMs ?? 25_000 : 65_000);
          if (lease) health.success(lease);
          notice?.({ action: "completed", ...identity(current), durationMs: Date.now() - start });
          return answer;
        } catch (error) {
          const reason = signal.aborted ? undefined : failoverReason(error);
          if (lease) { if (reason) health.failure(lease, reason); else health.release(lease); }
          notice?.({ action: "failed", ...identity(current), durationMs: Date.now() - start, ...(reason ? { reason } : {}), ...(error instanceof UpstreamError ? { httpStatus: error.status } : {}) });
          if (!reason || !canSwitch || exposedAnswer || signal.aborted) throw error;
          changeProvider(reason);
        }
      }
      throw new ProviderResponseError("provider_unavailable", "The AI services are temporarily unavailable. Please try again shortly.");
    },
  };
}

/** One-off calls; the chat route retains a session for its whole research turn. */
export async function complete(messages: LlmMessage[], tools: Tool[], signal: AbortSignal, forceLookup = false, observer?: CompletionObserver) {
  return createCompletionSession().complete(messages, tools, signal, forceLookup, observer);
}
