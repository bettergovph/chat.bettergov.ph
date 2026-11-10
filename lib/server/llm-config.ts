export type LlmProvider = "zai" | "nyolab" | "custom";
export type LlmConfig = {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort: string;
  streaming: boolean;
};

export function getFallbackLlmConfig(primary: LlmConfig, env: Record<string, string | undefined> = process.env): LlmConfig | undefined {
  const selected = env.LLM_FALLBACK_PROVIDER?.trim().toLowerCase();
  if (!selected || selected === "off") return undefined;
  if (selected !== "zai" && selected !== "nyolab") throw new Error("Invalid LLM_FALLBACK_PROVIDER configuration.");
  if (selected === primary.provider) return undefined;
  const fallback = getLlmConfig({ ...env, LLM_PROVIDER: selected });
  if (fallback.baseUrl === primary.baseUrl) throw new Error("The backup must use a different AI endpoint.");
  return fallback;
}

/** Named profiles never borrow another provider's key or legacy endpoint. */
export function getLlmConfig(env: Record<string, string | undefined> = process.env): LlmConfig {
  const selected = env.LLM_PROVIDER?.trim().toLowerCase();
  if (selected && !["zai", "nyolab", "custom"].includes(selected)) throw new Error("Invalid LLM_PROVIDER configuration.");
  const defaults = {
    zai: { baseUrl: "https://api.z.ai/api/paas/v4", model: "glm-5.3-flash" },
    nyolab: { baseUrl: "https://llm.nyolab.ai/api/public/v1", model: "glm-5.3-flash" },
  };
  const named = selected === "zai" || selected === "nyolab" ? selected : undefined;
  const prefix = named?.toUpperCase();
  // Keep old LLM_* deployments working when no provider has been selected.
  const baseUrl = (named ? env[`${prefix}_BASE_URL`] || defaults[named].baseUrl : env.LLM_BASE_URL || defaults.zai.baseUrl).trim().replace(/\/+$/, "");
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || (env.NODE_ENV === "production" && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) throw new Error("Invalid AI endpoint configuration.");
  const provider: LlmProvider = named ?? (selected === "custom" ? "custom" : url.hostname === "api.z.ai" ? "zai" : url.hostname === "llm.nyolab.ai" ? "nyolab" : "custom");
  const apiKey = (named ? env[`${prefix}_API_KEY`] : env.LLM_API_KEY)?.trim();
  if (!apiKey) throw new Error("The selected AI provider is not configured on the server.");
  const model = (named ? env[`${prefix}_MODEL`] || defaults[named].model : env.LLM_MODEL || defaults.zai.model).trim();
  if (!model) throw new Error("Invalid AI model configuration.");
  const reasoningEffort = (named ? env[`${prefix}_REASONING_EFFORT`] || env.LLM_REASONING_EFFORT || "low" : env.LLM_REASONING_EFFORT || "low").trim();
  if (provider !== "custom" && !["low", "high", "max"].includes(reasoningEffort)) throw new Error("Invalid LLM reasoning effort configuration.");
  return { provider, baseUrl, apiKey, model, reasoningEffort, streaming: env.LLM_STREAMING !== "off" };
}
