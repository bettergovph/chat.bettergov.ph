import { existsSync, readFileSync } from "node:fs";

export function workerConfigPath() {
  return process.env.CLOUDFLARE_CONFIG || (existsSync("wrangler.local.jsonc") ? "wrangler.local.jsonc" : "wrangler.jsonc");
}
export function readWorkerConfig(path = workerConfigPath()) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\s*\/\/.*$/gm, ""));
}
