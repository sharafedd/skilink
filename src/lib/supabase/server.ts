// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/** Read-only Supabase client for Server Components */
export async function createSupabaseServerRO() {
  const cookieStore = await cookies();
  const hdrs = await headers();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
      global: {
        headers: { "X-Client-Info": hdrs.get("X-Client-Info") ?? "skilink" },
      },
    }
  );
}
