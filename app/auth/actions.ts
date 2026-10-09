"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/data/supabase-server";

export async function signIn() {
  if (!process.env.APP_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    redirect("/login?error=config");
  }
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback", process.env.APP_URL).toString(),
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?error=unavailable");
  redirect(data.url);
}

export async function signOut() {
  const client = await createServerSupabaseClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/login?error=signout");
  redirect("/login");
}
