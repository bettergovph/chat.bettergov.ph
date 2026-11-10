import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { readWorkerConfig, workerConfigPath } from "./cloudflare-config.mjs";

const local = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Set CLOUDFLARE_API_TOKEN for your Cloudflare account before deploying.");
const configPath = workerConfigPath();
const config = readWorkerConfig(configPath);
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || config.account_id;
if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("Configure your CLOUDFLARE_ACCOUNT_ID before deploying.");
const origin = config.vars.APP_ORIGIN;
const site = origin ? new URL(origin) : undefined;
if (site && (site.protocol !== "https:" || site.username || site.password || site.pathname !== "/" || site.search || site.hash)) throw new Error("APP_ORIGIN must be an HTTPS origin without a path, query or credentials.");
const hostname = site?.hostname;
const domainsUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/domains`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const domains = hostname ? await (await fetch(domainsUrl, { headers })).json() : { success: true, result: [] };
if (!domains.success) throw new Error("Cannot verify the account's Worker domains.");
const domain = domains.result.find(item => item.hostname === hostname);
if (domain && domain.service !== config.name) throw new Error(`${hostname} is already assigned to a different Worker.`);
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
if (hostname && !domain && (!zoneId || !/^[a-f0-9]{32}$/i.test(zoneId))) throw new Error("Set CLOUDFLARE_ZONE_ID to attach a new custom domain.");
const secrets = {};
const provider = config.vars.LLM_PROVIDER;
if (provider && !["zai", "nyolab", "custom"].includes(provider)) throw new Error("Invalid LLM_PROVIDER in wrangler.jsonc.");
const activeKey = provider === "zai" ? "ZAI_API_KEY" : provider === "nyolab" ? "NYOLAB_API_KEY" : "LLM_API_KEY";
const required = new Set([activeKey, "TYPESAFE_API_KEY", "MEILI_API_KEY"]);
const fallback = config.vars.LLM_FALLBACK_PROVIDER;
if (fallback && !["zai", "nyolab", "off"].includes(fallback)) throw new Error("Invalid LLM_FALLBACK_PROVIDER in wrangler.jsonc.");
if (fallback && fallback !== "off" && fallback !== provider) required.add(`${fallback.toUpperCase()}_API_KEY`);
// Upload both profiles when available, preserving the legacy key for rollback.
// Never replace LLM_API_KEY with the selected provider's credential.
for (const key of ["ZAI_API_KEY", "NYOLAB_API_KEY", "LLM_API_KEY", "TYPESAFE_API_KEY", "MEILI_API_KEY"]) {
  const value = process.env[key] || local[key];
  if (!value && required.has(key)) throw new Error(`Missing server secret: ${key}`);
  if (value) secrets[key] = value;
}
const directory = mkdtempSync(join(tmpdir(), "kuya-j-deploy-"));
let status = 1;
try {
  const file = join(directory, "secrets.json");
  writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
  const deployment = spawnSync("node_modules/.bin/opennextjs-cloudflare", ["deploy", "--config", configPath, "--secrets-file", file], { stdio: "inherit", env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId } });
  status = deployment.status ?? 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
if (status === 0 && hostname && !domain) {
  const response = await fetch(domainsUrl, { method: "PUT", headers, body: JSON.stringify({
    hostname, service: config.name, environment: "production", zone_id: zoneId,
  }) });
  const result = await response.json();
  if (!result.success) throw new Error("Worker uploaded, but the custom domain could not be attached.");
}
if (status === 0) console.log(hostname ? `Deployed: https://${hostname}` : `Deployed Worker: ${config.name}. See Wrangler output for the workers.dev URL.`);
process.exit(status);
