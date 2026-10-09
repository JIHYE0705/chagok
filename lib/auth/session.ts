import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../data/supabase-server";

export async function getCurrentUser() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export const requireAppUser = cache(async () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    redirect("/login?error=config");
  }
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=session");
  const client = await createServerSupabaseClient();
  const { data, error } = await client.rpc("has_app_access");
  if (error) redirect("/login?error=unavailable");
  if (!data) redirect("/login?error=denied");
  return user;
});
