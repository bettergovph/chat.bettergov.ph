import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Chat uses uncached, per-request evidence; no persistent response cache is needed.
export default defineCloudflareConfig({});
