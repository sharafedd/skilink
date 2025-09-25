"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/* ---------- RW Supabase (valid in Server Actions / Route Handlers) ---------- */

function toNextOptions(o: CookieOptions) {
  let expires: Date | undefined;
  if (o.expires instanceof Date) expires = o.expires;
  else if (typeof o.expires === "string" || typeof o.expires === "number") expires = new Date(o.expires);

  return {
    domain: o.domain,
    expires,
    httpOnly: o.httpOnly,
    maxAge: o.maxAge,
    path: o.path,
    sameSite: (o.sameSite as "lax" | "strict" | "none") ?? "lax",
    secure: o.secure,
  } as const;
}

async function getSupabaseRW() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookies()).get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          (await cookies()).set(name, value, toNextOptions(options));
        },
        async remove(name: string, options: CookieOptions) {
          (await cookies()).delete({ name, ...toNextOptions(options) });
        },
      },
    }
  );
}

/* --------------------------------- helpers --------------------------------- */

function getStr(v: FormDataEntryValue | null) {
  return String(v ?? "").trim();
}

/* ---------------------------------- actions -------------------------------- */

export async function signUpAction(formData: FormData) {
  const email = getStr(formData.get("email")).toLowerCase();
  const password = getStr(formData.get("password"));
  const name = getStr(formData.get("name"));

  if (!email || !password) throw new Error("Email & password are required.");

  const supabase = await getSupabaseRW();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  // Friendly page after sending verification email
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function signInAction(formData: FormData) {
  const email = getStr(formData.get("email")).toLowerCase();
  const password = getStr(formData.get("password"));

  if (!email || !password) throw new Error("Email & password are required.");

  const supabase = await getSupabaseRW();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signOutAction() {
  const supabase = await getSupabaseRW();
  await supabase.auth.signOut(); // clears auth cookies via RW client (Next 15-safe)
  redirect("/");
}
