// src/lib/auth.ts
import { createSupabaseServerRO } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  name?: string | null;
};

export async function getSession() {
  const supabase = await createSupabaseServerRO();
  return supabase.auth.getSession(); // { data: { session }, error }
}

export async function getUser() {
  const supabase = await createSupabaseServerRO();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  const u = data.user;
  const user: SessionUser | null = u
    ? { id: u.id, email: u.email ?? null, name: (u.user_metadata as any)?.name ?? null }
    : null;
  return { user, error: null };
}

/** If you still had this before, it's not needed anymore with RW signOut in actions.
 * Keep a stub to avoid import errors elsewhere, or remove call sites. */
export async function clearSession() {
  // no-op in RSC; cookie clearing must happen in a Server Action/Route Handler.
}

// --- compatibility shims ---
export async function getCurrentUser() {
  const { user } = await getUser();
  return user; // returns SessionUser | null
}

export async function getCurrentSession() {
  const { data } = await getSession();
  return data.session; // returns Session | null
}
