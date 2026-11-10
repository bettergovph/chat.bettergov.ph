import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { workerConfigPath } from "./cloudflare-config.mjs";

const provider = process.argv[2];
if (!["zai", "nyolab"].includes(provider) || process.argv.length !== 3) {
  console.error("Usage: npm run provider:use -- zai|nyolab");
  process.exit(1);
}
const configPath = workerConfigPath();
const originalConfig = readFileSync(configPath, "utf8");
if (!/"LLM_PROVIDER":\s*"[^"]+"/.test(originalConfig)) throw new Error("Missing provider selector in wrangler.jsonc.");
const updatedConfig = originalConfig.replace(/("LLM_PROVIDER":\s*)"[^"]+"/, `$1"${provider}"`);
const hasLocal = existsSync(".env.local");
const originalEnv = hasLocal ? readFileSync(".env.local", "utf8") : "";
const local = parseEnv(originalEnv);
const keyName = `${provider.toUpperCase()}_API_KEY`;
if (hasLocal && !local[keyName] && !process.env[keyName]) throw new Error(`Configure ${keyName} before selecting ${provider}.`);
const updatedEnv = /^LLM_PROVIDER=.*$/m.test(originalEnv) ? originalEnv.replace(/^LLM_PROVIDER=.*$/m, `LLM_PROVIDER=${provider}`) : originalEnv.trimEnd() + `\nLLM_PROVIDER=${provider}\n`;
try {
  writeFileSync(configPath, updatedConfig);
  if (hasLocal) writeFileSync(".env.local", updatedEnv, { mode: 0o600 });
} catch (error) {
  writeFileSync(configPath, originalConfig);
  if (hasLocal) writeFileSync(".env.local", originalEnv, { mode: 0o600 });
  throw error;
}
console.log(`Selected ${provider}. Provider keys were not changed.`);
console.log("Restart the local server to apply locally; run npm run cf:deploy to publish. This command does not deploy.");
