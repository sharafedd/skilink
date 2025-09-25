// src/app/(site)/profile/page.tsx
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

type AppUser = {
  id: string;
  auth_id: string | null;
  email: string | null;
  is_provider: boolean;
  role: "buyer" | "provider" | "admin";
};

type UserProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  website: string | null;
  languages: string[] | null;
};

type UserSettings = {
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  currency: string | null;
};

type ProviderProfile = {
  user_id: string;
  display_name: string | null;
  hourly_rate: number | null;
  min_project_value: number | null;
  years_experience: number | null;
  on_site: boolean | null;
  remote: boolean | null;
  verified: boolean | null;
};

type Category = { id: string; slug: string; name: string };
type Skill = { id: string; slug: string; name: string };
type ProviderService = { user_id: string; category_id: string };
type ProviderSkill = { user_id: string; skill_id: string; level: number | null };

/* ----------------- Server actions ----------------- */

async function saveProfile(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const authUser = await getCurrentUser();
  if (!authUser) return;

  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const userId = urow?.id as string | undefined;
  if (!userId) return;

  const display_name = String(formData.get("display_name") || "").trim() || null;
  const headline = String(formData.get("headline") || "").trim() || null;
  const bio = String(formData.get("bio") || "").trim() || null;
  const country = String(formData.get("country") || "").trim() || null;
  const city = String(formData.get("city") || "").trim() || null;
  const timezone = String(formData.get("timezone") || "").trim() || null;
  const website = String(formData.get("website") || "").trim() || null;
  const languagesStr = String(formData.get("languages") || "").trim();
  const languages = languagesStr ? languagesStr.split(",").map((s) => s.trim()).filter(Boolean) : [];

  await supabase
    .from("user_profiles")
    .upsert({
      user_id: userId,
      display_name,
      headline,
      bio,
      country,
      city,
      timezone,
      website,
      languages,
      updated_at: new Date().toISOString(),
    });

  revalidatePath("/profile");
}

async function saveSettings(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const authUser = await getCurrentUser();
  if (!authUser) return;

  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const userId = urow?.id as string | undefined;
  if (!userId) return;

  const email_notifications = formData.get("email_notifications") === "on";
  const push_notifications = formData.get("push_notifications") === "on";
  const currency = String(formData.get("currency") || "DZD");

  await supabase
    .from("user_settings")
    .upsert({
      user_id: userId,
      email_notifications,
      push_notifications,
      currency,
      updated_at: new Date().toISOString(),
    });

  revalidatePath("/profile");
}

async function setProviderMode(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const authUser = await getCurrentUser();
  if (!authUser) return;

  const target = String(formData.get("value") || "on"); // "on" | "off"
  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const userId = urow?.id as string | undefined;
  if (!userId) return;

  await supabase.from("users").update({ is_provider: target === "on", updated_at: new Date().toISOString() }).eq("id", userId);

  if (target === "on") {
    // Ensure a provider_profile row exists
    const { data: profile } = await supabase
      .from("provider_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!profile) {
      const { data: up } = await supabase.from("user_profiles").select("display_name").eq("user_id", userId).limit(1).maybeSingle();
      await supabase.from("provider_profiles").insert({
        user_id: userId,
        display_name: (up as { display_name: string | null } | null)?.display_name ?? null,
        remote: true,
        on_site: false,
        verified: false,
      });
    }
  }

  revalidatePath("/profile");
}

async function saveProviderBasics(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const authUser = await getCurrentUser();
  if (!authUser) return;

  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const userId = urow?.id as string | undefined;
  if (!userId) return;

  const display_name = String(formData.get("p_display_name") || "").trim() || null;
  const hourly_rate_raw = Number(String(formData.get("hourly_rate") || "").trim());
  const hourly_rate = Number.isFinite(hourly_rate_raw) ? hourly_rate_raw : null;
  const min_project_value_raw = Number(String(formData.get("min_project_value") || "").trim());
  const min_project_value = Number.isFinite(min_project_value_raw) ? min_project_value_raw : null;
  const years_experience_raw = Number(String(formData.get("years_experience") || "").trim());
  const years_experience = Number.isFinite(years_experience_raw) ? years_experience_raw : null;
  const on_site = formData.get("on_site") === "on";
  const remote = formData.get("remote") !== "off"; // default true if not given

  await supabase
    .from("provider_profiles")
    .upsert({
      user_id: userId,
      display_name,
      hourly_rate,
      min_project_value,
      years_experience,
      on_site,
      remote,
      updated_at: new Date().toISOString(),
    });

  revalidatePath("/profile");
}

async function addService(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const authUser = await getCurrentUser();
  if (!authUser) return;

  const slug = String(formData.get("cat_slug") || "").trim();
  if (!slug) return;

  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const userId = urow?.id as string | undefined;
  if (!userId) return;

  const { data: cat } = await supabase
    .from("service_categories")
    .select("id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  const catId = (cat as { id: string } | null)?.id;
  if (!catId) return;

  await supabase.from("provider_services").insert({ user_id: userId, category_id: catId });
  revalidatePath("/profile");
}

async function removeService(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const authUser = await getCurrentUser();
  if (!authUser) return;

  const category_id = String(formData.get("category_id") || "");
  if (!category_id) return;

  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const userId = urow?.id as string | undefined;
  if (!userId) return;

  await supabase.from("provider_services").delete().eq("user_id", userId).eq("category_id", category_id);
  revalidatePath("/profile");
}

async function addSkill(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const authUser = await getCurrentUser();
  if (!authUser) return;

  const slug = String(formData.get("skill_slug") || "").trim();
  const levelRaw = Number(String(formData.get("skill_level") || "").trim());
  const level = Number.isFinite(levelRaw) ? Math.max(1, Math.min(5, levelRaw)) : 3;
  if (!slug) return;

  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const userId = urow?.id as string | undefined;
  if (!userId) return;

  const { data: sk } = await supabase.from("skills").select("id").eq("slug", slug).limit(1).maybeSingle();
  const skillId = (sk as { id: string } | null)?.id;
  if (!skillId) return;

  await supabase.from("provider_skills").upsert({ user_id: userId, skill_id: skillId, level });
  revalidatePath("/profile");
}

async function removeSkill(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const authUser = await getCurrentUser();
  if (!authUser) return;

  const skill_id = String(formData.get("skill_id") || "");
  if (!skill_id) return;

  const { data: urow } = await supabase
    .from("users")
    .select("id,auth_id")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();
  const userId = urow?.id as string | undefined;
  if (!userId) return;

  await supabase.from("provider_skills").delete().eq("user_id", userId).eq("skill_id", skill_id);
  revalidatePath("/profile");
}

/* ----------------- Page ----------------- */

export default async function ProfilePage() {
  const [authUser, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!authUser) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please{" "}
            <Link href="/auth/sign-in" className="text-blue-600 hover:underline">
              sign in
            </Link>{" "}
            to manage your profile.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Resolve app user
  let me: AppUser | null = null;

  const { data: byAuth } = await supabase
    .from("users")
    .select("id,auth_id,email,is_provider,role")
    .eq("auth_id", authUser.id)
    .limit(1)
    .maybeSingle();

  if (byAuth) {
    me = byAuth as AppUser;
  } else if (authUser.email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id,auth_id,email,is_provider,role")
      .eq("email", authUser.email)
      .limit(1)
      .maybeSingle();

    if (byEmail) {
      await supabase
        .from("users")
        .update({ auth_id: authUser.id, updated_at: new Date().toISOString() })
        .eq("id", byEmail.id);

      me = { ...(byEmail as AppUser), auth_id: authUser.id };
    } else {
      const { data: created } = await supabase
        .from("users")
        .insert({
          email: authUser.email,
          auth_id: authUser.id,
          role: "buyer",
          is_provider: false,
        })
        .select("id,auth_id,email,is_provider,role")
        .single();

      me = created as AppUser;
    }
  }
  if (!me) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
        <Card>
          <CardContent className="p-6 text-sm">We couldn’t find your account record.</CardContent>
        </Card>
      </div>
    );
  }

  // Load profile + settings
  const [{ data: prof }, { data: sets }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", me.id).limit(1).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", me.id).limit(1).maybeSingle(),
  ]);
  const profile = (prof as UserProfile | null) ?? {
    user_id: me.id,
    display_name: null,
    avatar_url: null,
    headline: null,
    bio: null,
    country: null,
    city: null,
    timezone: null,
    website: null,
    languages: [],
  };
  const settings = (sets as UserSettings | null) ?? {
    user_id: me.id,
    email_notifications: true,
    push_notifications: true,
    currency: "DZD",
  };

  // Provider info (if provider mode)
  let provider: ProviderProfile | null = null;
  let services: Array<ProviderService & { category: Category | null }> = [];
  let skills: Array<ProviderSkill & { skill: Skill | null }> = [];

  if (me.is_provider) {
    const [{ data: ppr }, { data: svc }, { data: skl }] = await Promise.all([
      supabase.from("provider_profiles").select("*").eq("user_id", me.id).limit(1).maybeSingle(),
      supabase
        .from("provider_services")
        .select("user_id,category_id,service_categories(id,slug,name)")
        .eq("user_id", me.id),
      supabase
        .from("provider_skills")
        .select("user_id,skill_id,level,skills(id,slug,name)")
        .eq("user_id", me.id),
    ]);
    provider = (ppr as ProviderProfile | null) ?? null;
    services =
      ((svc as Array<{ user_id: string; category_id: string; service_categories: Category | null }> | null) ?? []).map(
        (r) => ({ user_id: r.user_id, category_id: r.category_id, category: r.service_categories ?? null })
      );
    skills =
      ((skl as Array<{ user_id: string; skill_id: string; level: number | null; skills: Skill | null }> | null) ?? []).map(
        (r) => ({ user_id: r.user_id, skill_id: r.skill_id, level: r.level, skill: r.skills ?? null })
      );
  }

  const langString = (profile.languages ?? []).join(", ");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Profile</h1>
        <div className="text-xs sm:text-sm text-muted-foreground">
          Signed in as {me.email ?? authUser.email ?? "user"}
        </div>
      </div>

      {/* Basic profile */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold">Basic information</h2>
          <form action={saveProfile} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-muted-foreground">Display name</label>
              <input name="display_name" defaultValue={profile.display_name ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">Headline</label>
              <input name="headline" defaultValue={profile.headline ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-muted-foreground">Bio</label>
              <textarea name="bio" defaultValue={profile.bio ?? ""} rows={4} className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">Country</label>
              <input name="country" defaultValue={profile.country ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">City</label>
              <input name="city" defaultValue={profile.city ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">Timezone</label>
              <input name="timezone" defaultValue={profile.timezone ?? ""} placeholder="Africa/Algiers" className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">Website</label>
              <input name="website" defaultValue={profile.website ?? ""} placeholder="https://…" className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-muted-foreground">Languages (comma-separated)</label>
              <input name="languages" defaultValue={langString} placeholder="ar, fr" className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div className="sm:col-span-2 flex flex-col sm:flex-row sm:justify-end">
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-white w-full sm:w-auto">Save profile</button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <h2 className="text-base sm:text-lg font-semibold">Settings</h2>
          <form action={saveSettings} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <input id="email_notifications" name="email_notifications" type="checkbox" defaultChecked={settings.email_notifications} />
              <label htmlFor="email_notifications" className="text-sm">Email notifications</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="push_notifications" name="push_notifications" type="checkbox" defaultChecked={settings.push_notifications} />
              <label htmlFor="push_notifications" className="text-sm">Push notifications</label>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground">Currency</label>
              <input name="currency" defaultValue={settings.currency ?? "DZD"} className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div className="sm:col-span-3 flex flex-col sm:flex-row sm:justify-end">
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-white w-full sm:w-auto">Save settings</button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Provider mode */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base sm:text-lg font-semibold">Provider mode</h2>
            <form action={setProviderMode} className="self-start sm:self-auto">
              <input type="hidden" name="value" value={me.is_provider ? "off" : "on"} />
              <button className="rounded-md border px-3 py-2 text-sm w-full sm:w-auto">
                {me.is_provider ? "Disable" : "Enable"} provider mode
              </button>
            </form>
          </div>

          {me.is_provider ? (
            <div className="space-y-6">
              {/* Provider basics */}
              <div className="space-y-3">
                <h3 className="font-medium">Basics</h3>
                <form action={saveProviderBasics} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <label className="block text-sm text-muted-foreground">Business / display name</label>
                    <input name="p_display_name" defaultValue={provider?.display_name ?? profile.display_name ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground">Hourly rate (DZD/h)</label>
                    <input name="hourly_rate" defaultValue={provider?.hourly_rate ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground">Min project (DZD)</label>
                    <input name="min_project_value" defaultValue={provider?.min_project_value ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground">Experience (years)</label>
                    <input name="years_experience" defaultValue={provider?.years_experience ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="on_site" name="on_site" type="checkbox" defaultChecked={provider?.on_site ?? false} />
                    <label htmlFor="on_site" className="text-sm">On-site</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input id="remote" name="remote" type="checkbox" defaultChecked={provider?.remote ?? true} />
                    <label htmlFor="remote" className="text-sm">Remote</label>
                  </div>
                  <div className="sm:col-span-3 flex flex-col sm:flex-row sm:justify-end">
                    <button className="rounded-md bg-black px-4 py-2 text-white w-full sm:w-auto">Save provider</button>
                  </div>
                </form>
              </div>

              {/* Services */}
              <div className="space-y-3">
                <h3 className="font-medium">Services (categories)</h3>
                <div className="flex flex-wrap gap-2">
                  {services.length ? (
                    services.map((s) => (
                      <form
                        key={s.category_id}
                        action={removeService}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                      >
                        <input type="hidden" name="category_id" value={s.category_id} />
                        <span>{s.category?.name ?? s.category_id}</span>
                        <button className="text-xs opacity-70 hover:opacity-100" aria-label="Remove">
                          Remove
                        </button>
                      </form>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No services yet.</span>
                  )}
                </div>
                <form action={addService} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <input
                    name="cat_slug"
                    placeholder="category slug (e.g., plumbing)"
                    className="rounded-md border px-3 py-2 w-full"
                  />
                  <button className="rounded-md border px-3 py-2 text-sm w-full sm:w-auto">Add service</button>
                </form>
              </div>

              {/* Skills */}
              <div className="space-y-3">
                <h3 className="font-medium">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {skills.length ? (
                    skills.map((sk) => (
                      <form
                        key={sk.skill_id}
                        action={removeSkill}
                        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                      >
                        <input type="hidden" name="skill_id" value={sk.skill_id} />
                        <span>
                          {sk.skill?.name ?? sk.skill_id}
                          {sk.level ? ` · L${sk.level}` : ""}
                        </span>
                        <button className="text-xs opacity-70 hover:opacity-100" aria-label="Remove">
                          Remove
                        </button>
                      </form>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No skills yet.</span>
                  )}
                </div>
                <form
                  action={addSkill}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-center"
                >
                  <input
                    name="skill_slug"
                    placeholder="skill slug (e.g., react)"
                    className="rounded-md border px-3 py-2 w-full"
                  />
                  <input
                    name="skill_level"
                    placeholder="level 1–5"
                    className="rounded-md border px-3 py-2 w-full sm:w-auto"
                  />
                  <button className="rounded-md border px-3 py-2 text-sm w-full sm:w-auto">
                    Add / update skill
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Turn on provider mode to list services, add skills and set your rates.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
