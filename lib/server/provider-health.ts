import type { LlmConfig } from "./llm-config.ts";
import { UpstreamError } from "./http.ts";

export type FailureReason = "model_unavailable" | "rate_limited" | "provider_unavailable" | "timeout" | "network_error" | "empty_response" | "invalid_response" | "interrupted_stream";
export class ProviderResponseError extends Error {
  constructor(public reason: FailureReason, message: string) { super(message); this.name = "ProviderResponseError"; }
}
export function failoverReason(error: unknown): FailureReason | undefined {
  if (error instanceof ProviderResponseError) return error.reason;
  if (error instanceof UpstreamError) {
    if (error.status === 404) return "model_unavailable";
    if (error.status === 429) return "rate_limited";
    if (error.status === 408) return "timeout";
    if (error.status >= 500 && error.status <= 599) return "provider_unavailable";
  }
}

type Unhealthy = { retryAt: number; reason: FailureReason; probe: boolean };
export type HealthLease = { key: string; state?: Unhealthy };
// Isolate-local health only: no conversations, credentials or persistent storage.
// A single real request probes a recovering provider; no background paid calls.
export class ProviderHealth {
  private states = new Map<string, Unhealthy>();
  constructor(private now = Date.now, private cooldownMs = 120_000) {}
  canAttempt(config: LlmConfig) {
    const state = this.states.get(`${config.provider}:${config.baseUrl}:${config.model}`);
    return !state || (state.retryAt <= this.now() && !state.probe);
  }
  acquire(config: LlmConfig): { lease: HealthLease } | { reason: FailureReason; retryAfterMs: number } {
    const key = `${config.provider}:${config.baseUrl}:${config.model}`;
    const state = this.states.get(key);
    if (!state) return { lease: { key } };
    if (state.retryAt > this.now() || state.probe) return { reason: state.reason, retryAfterMs: Math.max(0, state.retryAt - this.now()) };
    state.probe = true;
    return { lease: { key, state } };
  }
  success(lease: HealthLease) {
    // An older concurrent success must not erase a newer failure.
    if (this.states.get(lease.key) === lease.state) this.states.delete(lease.key);
  }
  failure(lease: HealthLease, reason: FailureReason) {
    if (this.states.get(lease.key) !== lease.state) return;
    if (this.states.size >= 32 && !this.states.has(lease.key)) this.states.delete(this.states.keys().next().value!);
    this.states.set(lease.key, { retryAt: this.now() + this.cooldownMs, reason, probe: false });
  }
  release(lease: HealthLease) {
    if (lease.state && this.states.get(lease.key) === lease.state) lease.state.probe = false;
  }
}
export const providerHealth = new ProviderHealth();
