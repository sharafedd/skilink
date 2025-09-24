// src/lib/auth.ts
import { supabaseServer } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await supabaseServer(); // ← await the client

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email!,
    name: profile?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0],
    avatar_url: profile?.avatar_url ?? null,
  };
}

export async function clearSession() {
  const supabase = await supabaseServer(); // ← await here too
  await supabase.auth.signOut();
}
