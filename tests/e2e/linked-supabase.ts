import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient, createChunks } from "@supabase/ssr";

let configuration: { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string; projectRef: string } | undefined;

export function linkedSupabase() {
  if (configuration) return configuration;
  const projectRef = process.env.SUPABASE_PROJECT_REF || readFileSync("supabase/.temp/project-ref", "utf8").trim();
  if (!/^[a-z]{20}$/.test(projectRef)) throw new Error("A linked Supabase project is required.");
  const keys: { name: string; api_key: string }[] = JSON.parse(execFileSync("node_modules/.bin/supabase", ["projects", "api-keys", "--project-ref", projectRef, "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  const anon = keys.find((key) => key.name === "anon")?.api_key;
  const service = keys.find((key) => key.name === "service_role")?.api_key;
  if (!anon || !service) throw new Error("Linked test credentials are unavailable.");
  configuration = { API_URL: `https://${projectRef}.supabase.co`, ANON_KEY: anon, SERVICE_ROLE_KEY: service, projectRef };
  return configuration;
}

function runFixtureSql(sql: string) {
  execFileSync("node_modules/.bin/supabase", ["db", "query", "--linked", "--project-ref", linkedSupabase().projectRef, sql], { stdio: "ignore" });
}

export function supabaseFixtures() {
  const users: string[] = [];
  const subjects: string[] = [];

  async function session(context: BrowserContext, invited: boolean, expiry?: "refresh" | "expired") {
    const status = linkedSupabase();
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const subject = randomUUID();
    const email = `${subject}@example.test`;
    const password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error("Could not create linked auth fixture.");
    const id = created.data.user.id;
    users.push(id);
    subjects.push(subject);
    // Google itself is not automated; provision a synthetic Auth identity in the linked DB.
    runFixtureSql(`insert into auth.identities (user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at) values ('${id}', '${subject}', 'google', '{"sub":"${subject}","email":"${email}"}', now(), now(), now());`);
    if (invited) {
      const { error } = await admin.from("access_allowlist").insert({ google_subject: subject });
      if (error) throw new Error("Could not provision linked invite.");
    }
    let cookies: { name: string; value: string }[] = [];
    const client = createServerClient(status.API_URL, status.ANON_KEY, {
      cookies: { getAll: () => cookies, setAll: (values) => { cookies = values; } },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.session) throw new Error("Could not sign in linked fixture.");
    if (invited) {
      const access = await client.rpc("authorize_current_user");
      expect(access.error).toBeNull();
      expect(access.data).toBe(true);
    }
    if (expiry) {
      const value = { ...signed.data.session, expires_at: 1 };
      if (expiry === "expired") value.refresh_token = "invalid-local-refresh-token";
      const name = cookies[0].name.replace(/\.\d+$/, "");
      cookies = createChunks(name, `base64-${Buffer.from(JSON.stringify(value)).toString("base64url")}`);
    }
    await context.addCookies(cookies.filter(({ value }) => value).map(({ name, value }) => ({
      name, value, url: "http://127.0.0.1:3104", sameSite: "Lax" as const,
    })));
    return { id, subject, client, admin };
  }

  async function cleanup() {
    const status = linkedSupabase();
    const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    for (const id of users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error("Could not clean linked user fixture.");
    }
    if (subjects.length) {
      const { error } = await admin.from("access_allowlist").delete().in("google_subject", subjects);
      if (error) throw new Error("Could not clean linked invite fixtures.");
    }
  }
  return { session, cleanup };
}
