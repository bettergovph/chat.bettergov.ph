// Never print matching content: findings may themselves be credentials.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const ref = process.argv.find(arg => arg.startsWith("--ref="))?.slice(6);
if (ref?.startsWith("-") || ref === "") throw new Error("Use a valid Git ref.");
const rules = [
  ["private network address", /\b(?:100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+|[\w.-]+\.ts\.net)\b/i],
  ["machine-specific path", /\/(?:home\/[a-z][\w.-]*|Users\/[a-z][\w.-]*|tmp\/codex[-/])/i],
  ["provider credential", /\b(?:rk_live_[\w-]{25,}|apikey_[\w-]{35,}|sk-(?:proj-)?[\w-]{25,}|gh[pousr]_[a-z\d]{30,}|github_pat_[\w]{30,}|AKIA[A-Z\d]{16}|[a-f\d]{32}\.[A-Za-z\d_-]{16,})\b/i],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
];
const secrets = existsSync(".env.local") ? Object.entries(parseEnv(readFileSync(".env.local", "utf8"))).filter(([key, value]) => /(?:KEY|TOKEN|SECRET|PASSWORD)$/.test(key) && value.length > 12 && !value.startsWith("your-")) : [];
const findings = [];
function inspect(path, bytes, object = "working tree") {
  const text = bytes.toString("utf8");
  for (const [category, pattern] of rules) if (pattern.test(text)) findings.push({ path, object, category });
  for (const [name, value] of secrets) if (bytes.includes(value)) findings.push({ path, object, category: `configured credential (${name})` });
  if (/(?:^|\/)\.env(?!\.example$)|(?:^|\/)\.dev\.vars|wrangler\.local\.jsonc$|\.(?:pem|key|p12|pfx)$/.test(path)) findings.push({ path, object, category: "private configuration file" });
}
let count = 0;
if (ref) {
  const seen = new Set();
  for (const line of execFileSync("git", ["rev-list", "--objects", ref], { encoding: "utf8" }).trim().split("\n")) {
    const [oid, ...parts] = line.split(" ");
    if (!parts.length || seen.has(oid)) continue;
    seen.add(oid);
    if (execFileSync("git", ["cat-file", "-t", oid], { encoding: "utf8" }).trim() !== "blob") continue;
    inspect(parts.join(" "), execFileSync("git", ["cat-file", "blob", oid], { maxBuffer: 30_000_000 }), oid.slice(0, 12));
    count++;
  }
} else {
  for (const path of execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)) {
    if (existsSync(path)) { inspect(path, readFileSync(path)); count++; }
  }
}
for (const finding of findings) console.error(JSON.stringify(finding));
console.log(`Public-source scan: ${count} ${ref ? "historical blobs" : "tracked files"}, ${findings.length} findings.`);
if (findings.length) process.exitCode = 1;
