// src/lib/supabase/admin.ts
import { createServerClient } from "@supabase/ssr";

/** Write-enabled Supabase client for Server Actions ONLY */
export function createSupabaseServerAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // keep only in server env
  return createServerClient(url, key, {
    cookies: { get() { return undefined; } }, // no user cookies for admin ops
    global: { headers: { "X-Client-Info": "skilink-admin" } },
  });
}
