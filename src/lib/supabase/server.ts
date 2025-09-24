import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

/** Next’s cookie options */
type NextCookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  priority?: "low" | "medium" | "high";
};

/** Map Supabase CookieOptions -> Next cookie options */
function toNextOptions(o: CookieOptions): NextCookieOptions {
  let expires: Date | undefined;
  if (o.expires instanceof Date) {
    expires = o.expires;
  } else if (typeof o.expires === "string" || typeof o.expires === "number") {
    expires = new Date(o.expires);
  }

  return {
    domain: o.domain,
    expires,
    httpOnly: o.httpOnly,
    maxAge: o.maxAge,
    path: o.path,
    sameSite: (o.sameSite as NextCookieOptions["sameSite"]) ?? "lax",
    secure: o.secure,
  };
}

export async function supabaseServer() {
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
        async set(name: string, value: string, options: CookieOptions) {
          const opts = toNextOptions(options);
          (await cookies()).set(name, value, opts);
        },
        async remove(name: string, options: CookieOptions) {
          const opts = toNextOptions(options);
          // Next 15 delete() object overload
          (await cookies()).delete({ name, ...opts });
        },
      },
      global: {
        headers: {
          "X-Client-Info": hdrs.get("X-Client-Info") ?? "skilink",
        },
      },
    }
  );
}
