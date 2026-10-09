import { defineConfig, devices } from "@playwright/test";
import { linkedSupabase } from "./tests/e2e/linked-supabase";

const auth = process.env.AUTH_E2E === "1" ? linkedSupabase() : null;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3104",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3104",
    url: "http://127.0.0.1:3104",
    reuseExistingServer: false,
    env: auth ? {
      NEXT_PUBLIC_SUPABASE_URL: auth.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: auth.ANON_KEY,
      APP_URL: "http://127.0.0.1:3104",
    } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
