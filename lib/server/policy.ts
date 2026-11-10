import { SOURCES, type SourceId } from "../sources.ts";
import { publicCitationUrl, resolveCitationUrl } from "../citations.ts";

// Product thresholds: deterministic boundary tests plus a live, labeled Jev evaluation.
export const POLICY = { spamBlock: 0.97, injectionBlock: 0.92, jailbreakBlock: 0.7, programmingBlock: 0.7, recipesBlock: 0.7, passageInjection: 0.7, passageRelevance: 0.25, sourceRelevant: 0.55, uncertainRoute: 0.5 };
export type NoulAnswer = { type: "noul"; noul: number };
export type ChoiceAnswer = { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };
export type Answers = Record<string, NoulAnswer | ChoiceAnswer>;
export function probability(answers: Answers, key: string) {
  const value = answers[key];
  if (value?.type !== "noul" || !Number.isFinite(value.noul) || value.noul < 0 || value.noul > 1) throw new Error("Invalid TypeSafe probability.");
  return value.noul;
}
export function decideInput(answers: Answers) {
  if (probability(answers, "injection") >= POLICY.injectionBlock) return "injection";
  if (probability(answers, "jailbreak") >= POLICY.jailbreakBlock) return "jailbreak";
  if (probability(answers, "spam") >= POLICY.spamBlock) return "spam";
  if (probability(answers, "programming") >= POLICY.programmingBlock) return "programming";
  if (probability(answers, "recipes") >= POLICY.recipesBlock) return "recipes";
  return "allow";
}
export function selectSources(answers: Answers): SourceId[] {
  const ranked = SOURCES.map(source => ({ id: source.id, score: probability(answers, `source_${source.id}`) })).sort((a, b) => b.score - a.score);
  const chosen = ranked.filter(source => source.score >= POLICY.sourceRelevant).slice(0, 4).map(source => source.id);
  if (answers.lookup_kind?.type === "choice" && answers.lookup_kind.choice === "overview") {
    // Country/civic introductions need a discovery route, not a perfect catalog match.
    // Include Jev's valid primary even when relevance scores disagree, then its
    // other relevant families. Safety screening runs before this selection.
    const primary = SOURCES.find(source => answers.primary?.type === "choice" && source.id === answers.primary.choice)?.id;
    return [...new Set<SourceId>(["services", ...(primary ? [primary] : []), ...chosen])].slice(0, 4);
  }
  // A narrow route is a retrieval optimization, never an authorization boundary.
  if (!chosen.length || (answers.primary?.type === "choice" && answers.primary.confidence < POLICY.uncertainRoute)) return SOURCES.map(source => source.id);
  return chosen;
}
export function decidePassage(answers: Answers, prefix: string): "keep" | "conflict" | "drop" {
  if (probability(answers, `${prefix}_injection`) >= POLICY.passageInjection) return "drop";
  if (probability(answers, `${prefix}_conflict`) >= 0.7) return "conflict";
  if (probability(answers, `${prefix}_relevant`) < POLICY.passageRelevance) return "drop";
  return "keep";
}
export function isSafeCitationUrl(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i.test(url.hostname) && !/\.(localhost|local|internal|ts\.net)\.?$/i.test(url.hostname); } catch { return false; }
}
export function linkCitations(content: string, citations: { id: number; url: string; originalUrls?: string[] }[]) {
  const allowed = new Map(citations.flatMap(c => { const url = publicCitationUrl(c); return url ? [[c.id, url] as const] : []; }));
  // Only numbers backed by retrieved evidence become clickable references.
  return content.replace(/\[(\d+)\](?:\([^)]*\))?/g, (_, id) => allowed.has(Number(id)) ? `[${id}](${allowed.get(Number(id))})` : "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      const target = resolveCitationUrl(url, citations);
      return target ? `[${label}](${target})` : label;
    });
}
