import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/data/supabase-server";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) redirect("/login?error=callback");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    redirect("/login?error=config");
  }
  const client = await createServerSupabaseClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) redirect("/login?error=callback");
  const access = await client.rpc("authorize_current_user");
  if (access.error || !access.data) {
    await client.auth.signOut({ scope: "local" });
    redirect(access.error ? "/login?error=unavailable" : "/login?error=denied");
  }
  redirect("/items");
}
