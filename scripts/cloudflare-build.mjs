import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

const build = spawnSync("node_modules/.bin/opennextjs-cloudflare", ["build"], { stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

// OpenNext copies .env files into this server module. Runtime configuration must
// come exclusively from Worker vars/secrets, never the developer's local files.
writeFileSync(".open-next/cloudflare/next-env.mjs", "export const production = {};\nexport const development = {};\nexport const test = {};\n");
const local = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};
const secrets = Object.entries({ ...local, ...process.env })
  .filter(([key, value]) => /(?:API_KEY|API_TOKEN|SECRET)$/.test(key) && value && value.length > 10);
function verify(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) verify(file);
    else {
      const bytes = readFileSync(file);
      for (const [key, value] of secrets) {
        if (bytes.includes(value)) throw new Error(`Build contains ${key} in ${file}; refusing deployment.`);
      }
    }
  }
}
verify(".open-next");
console.log("Cloudflare bundle verified: runtime credentials are not embedded.");
