import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  webServer: process.env.CI ? { command: "npm run start -- --port 3000", url: "http://127.0.0.1:3000", reuseExistingServer: false, timeout: 30000 } : undefined,
  use: { baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3000", ...devices["Desktop Chrome"], launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}, screenshot: "only-on-failure", trace: "retain-on-failure" },
});
