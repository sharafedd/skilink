import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

type AppUser = {
  id: string;
  auth_id: string | null;
  email: string | null;
  role: "buyer" | "provider" | "admin";
  is_provider: boolean;
  deleted_at: string | null;
};

type UserSettings = {
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  currency: string | null;
};

type UserProfile = {
  user_id: string;
  timezone: string | null;
  languages: string[] | null;
};

/* ---------- Server actions ---------- */

async function saveNotifications(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");

  const { data: u } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", auth.id)
    .limit(1)
    .maybeSingle();

  const userId = u?.id as string | undefined;
  if (!userId) return redirect("/settings");

  const email_notifications = formData.get("email_notifications") === "on";
  const push_notifications = formData.get("push_notifications") === "on";

  await supabase.from("user_settings").upsert({
    user_id: userId,
    email_notifications,
    push_notifications,
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/settings");
}

async function savePreferences(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");

  const { data: u } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", auth.id)
    .limit(1)
    .maybeSingle();

  const userId = u?.id as string | undefined;
  if (!userId) return redirect("/settings");

  const currency = String(formData.get("currency") || "DZD").trim();
  const timezone = (String(formData.get("timezone") || "").trim() || null) as string | null;
  const languagesStr = String(formData.get("languages") || "").trim();
  const languages = languagesStr ? languagesStr.split(",").map((s) => s.trim()).filter(Boolean) : [];

  await Promise.all([
    supabase.from("user_settings").upsert({
      user_id: userId,
      currency,
      updated_at: new Date().toISOString(),
    }),
    supabase.from("user_profiles").upsert({
      user_id: userId,
      timezone,
      languages,
      updated_at: new Date().toISOString(),
    }),
  ]);

  revalidatePath("/settings");
}

async function deleteAccount(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");

  const confirm = String(formData.get("confirm") || "");
  if (confirm !== "DELETE") return redirect("/settings");

  const { data: u } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", auth.id)
    .limit(1)
    .maybeSingle();

  const userId = u?.id as string | undefined;
  if (!userId) return redirect("/settings");

  // Soft delete the account (keep auth session intact)
  await supabase
    .from("users")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", userId);

  redirect("/");
}

/* ---------- Page ---------- */

export default async function SettingsPage() {
  const [authUser, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!authUser) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please <Link href="/login" className="text-blue-600 hover:underline">sign in</Link> to manage your account settings.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id,email,role,is_provider,deleted_at")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();

  const me = (urow as AppUser | null) ?? null;

  if (!me) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            We couldn’t find your account record. If this persists, contact support.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ data: srow }, { data: prow }] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", me.id).limit(1).maybeSingle(),
    supabase.from("user_profiles").select("user_id,timezone,languages").eq("user_id", me.id).limit(1).maybeSingle(),
  ]);

  const settings: UserSettings = (srow as UserSettings | null) ?? {
    user_id: me.id,
    email_notifications: true,
    push_notifications: true,
    currency: "DZD",
  };
  const profile: UserProfile = (prow as UserProfile | null) ?? {
    user_id: me.id,
    timezone: null,
    languages: [],
  };

  const langString = (profile.languages ?? []).join(", ");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <div className="text-sm text-muted-foreground">
          Signed in as {me.email ?? authUser.email ?? "user"}
        </div>
      </div>

      {/* Account overview */}
      <Card>
        <CardContent className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">Account</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-muted-foreground">Email</div>
              <div>{me.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Role</div>
              <div className="capitalize">{me.role ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Provider mode</div>
              <div>{me.is_provider ? "Enabled" : "Disabled"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <div>{me.deleted_at ? "Deactivated" : "Active"}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            To change your email or password, go to your authentication account page.
          </p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <form action={saveNotifications} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="email_notifications" defaultChecked={settings.email_notifications} />
              <span className="text-sm">Email notifications</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="push_notifications" defaultChecked={settings.push_notifications} />
              <span className="text-sm">Push notifications</span>
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">Save</button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Preferences</h2>
          <form action={savePreferences} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-muted-foreground">Currency</label>
              <input
                name="currency"
                defaultValue={settings.currency ?? "DZD"}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">Timezone</label>
              <input
                name="timezone"
                defaultValue={profile.timezone ?? ""}
                placeholder="Africa/Algiers"
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm text-muted-foreground">Languages (comma-separated)</label>
              <input
                name="languages"
                defaultValue={langString}
                placeholder="ar, fr"
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">Save</button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="text-lg font-semibold text-red-600">Danger zone</h2>
          <p className="text-sm text-muted-foreground">
            Deleting your account is permanent and cannot be undone. Your projects and contracts may remain for audit.
          </p>
          <form action={deleteAccount} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm text-muted-foreground">
                Type <code>DELETE</code> to confirm
              </label>
              <input
                name="confirm"
                className="mt-1 w-full rounded-md border px-3 py-2"
                placeholder="DELETE"
                pattern="DELETE"
                title='Type "DELETE"'
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <button type="submit" className="w-full rounded-md border border-red-600 text-red-600 px-4 py-2">
                Delete account
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
