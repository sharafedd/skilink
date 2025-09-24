"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { clearSession } from "@/lib/auth";

function getStr(v: FormDataEntryValue | null) {
  return String(v ?? "").trim();
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const name = String(formData.get("name") || "").trim();
  if (!email || !password) throw new Error("Email & password are required.");

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  // redirect to a friendly page
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
}

export async function signInAction(formData: FormData) {
  const email = getStr(formData.get("email")).toLowerCase();
  const password = getStr(formData.get("password"));
  if (!email || !password) throw new Error("Email & password are required.");

  const supabase = await supabaseServer();              // ← await
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  redirect("/");
}

export async function signOutAction() {
  await clearSession();
  redirect("/");
}
