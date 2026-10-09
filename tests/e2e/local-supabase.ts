import { execFileSync } from "node:child_process";

export function localSupabase() {
  const status = JSON.parse(execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }));
  if (status.API_URL !== "http://127.0.0.1:54321") throw new Error("Auth fixtures require local Supabase.");
  return status as { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };
}
