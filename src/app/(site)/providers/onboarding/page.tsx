import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

/* ============= Types ============= */
type AppUser = { id: string; auth_id: string | null; email: string | null; role: "buyer" | "provider" | "admin"; is_provider: boolean };
type UserProfile = {
  user_id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  website: string | null;
  languages: string[] | null;
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

type Category = { id: string; name: string; parent_id: string | null };
type Skill = { id: string; name: string };

type SearchParams = { next?: string };

/* ============= Helpers ============= */
async function resolveOrCreateAppUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerRO>>,
  authId: string,
  email: string | null
): Promise<AppUser | null> {
  const { data: byAuth } = await supabase
    .from("users")
    .select("id,auth_id,email,role,is_provider")
    .eq("auth_id", authId)
    .limit(1)
    .maybeSingle();
  if (byAuth) return byAuth as AppUser;

  if (email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id,auth_id,email,role,is_provider")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    const row = byEmail as AppUser | null;
    if (row) {
      await supabase.from("users").update({ auth_id: authId, updated_at: new Date().toISOString() }).eq("id", row.id);
      return { ...row, auth_id: authId };
    }
  }

  if (!email) return null;

  const { data: created } = await supabase
    .from("users")
    .insert({ email, auth_id: authId, role: "buyer", is_provider: false })
    .select("id,auth_id,email,role,is_provider")
    .single();

  return (created as AppUser | null) ?? null;
}

function toNum(n: string | null, int = false): number | null {
  if (!n) return null;
  const v = int ? parseInt(n, 10) : Number(n);
  return Number.isFinite(v) ? v : null;
}

function boolFrom(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true" || form.get(key) === "1";
}

/* ============= Server action ============= */
async function saveOnboarding(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return redirect("/login");

  // Basic profile
  const display_name = String(formData.get("display_name") || "").trim() || null;
  const headline = String(formData.get("headline") || "").trim() || null;
  const bio = String(formData.get("bio") || "").trim() || null;
  const country = String(formData.get("country") || "").trim() || null;
  const city = String(formData.get("city") || "").trim() || null;
  const timezone = String(formData.get("timezone") || "").trim() || null;
  const website = String(formData.get("website") || "").trim() || null;
  const languagesStr = String(formData.get("languages") || "").trim();
  const languages = languagesStr ? languagesStr.split(",").map((s) => s.trim()).filter(Boolean) : [];

  // Role / provider toggle
  const wantProvider = boolFrom(formData, "is_provider");
  const roleChoice = wantProvider ? "provider" : "buyer";

  // Provider fields
  const hourly_rate = toNum(String(formData.get("hourly_rate") || "").trim());
  const min_project_value = toNum(String(formData.get("min_project_value") || "").trim());
  const years_experience = toNum(String(formData.get("years_experience") || "").trim(), true);
  const on_site = boolFrom(formData, "on_site");
  const remote = boolFrom(formData, "remote") || !on_site;

  // Selected categories/skills
  const categories = formData.getAll("categories").map(String).filter(Boolean);
  const skills = formData.getAll("skills").map(String).filter(Boolean);

  // Upserts
  await supabase
    .from("users")
    .update({ role: roleChoice, is_provider: wantProvider, updated_at: new Date().toISOString() })
    .eq("id", me.id);

  await supabase.from("user_profiles").upsert({
    user_id: me.id,
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

  if (wantProvider) {
    await supabase.from("provider_profiles").upsert({
      user_id: me.id,
      display_name: display_name,
      hourly_rate,
      min_project_value,
      years_experience,
      on_site,
      remote,
      verified: false,
      updated_at: new Date().toISOString(),
    });

    if (categories.length) {
      const svcRows = categories.map((cid) => ({ user_id: me.id, category_id: cid }));
      await supabase.from("provider_services").upsert(svcRows, { onConflict: "user_id,category_id" });
    }
    if (skills.length) {
      // Default all levels to 3
      const sklRows = skills.map((sid) => ({ user_id: me.id, skill_id: sid, level: 3 }));
      await supabase.from("provider_skills").upsert(sklRows, { onConflict: "user_id,skill_id" });
    }
  }

  revalidatePath("/profile");
  const next = String(formData.get("next") || "") || "/profile";
  redirect(next);
}

/* ============= Page ============= */
export default async function OnboardingPage({ searchParams }: { searchParams?: SearchParams }) {
  const next = typeof searchParams?.next === "string" ? searchParams!.next : "/profile";
  const [auth, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);

  if (!auth) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold">Welcome to Skilink</h1>
        <Card><CardContent className="p-6 text-sm">Please <Link className="text-blue-600 hover:underline" href="/login">sign in</Link> to continue.</CardContent></Card>
      </div>
    );
  }

  // Resolve user & load existing data to prefill
  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return null;

  const [{ data: up }, { data: pp }, { data: svcs }, { data: sks }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", me.id).maybeSingle(),
    supabase.from("provider_profiles").select("*").eq("user_id", me.id).maybeSingle(),
    supabase.from("provider_services").select("category_id").eq("user_id", me.id),
    supabase.from("provider_skills").select("skill_id,level").eq("user_id", me.id),
  ]);

  const profile = (up as UserProfile | null) ?? null;
  const provider = (pp as ProviderProfile | null) ?? null;
  const myCatIds = new Set<string>(((svcs as Array<{ category_id: string }> | null) ?? []).map((r) => r.category_id));
  const mySkillIds = new Set<string>(((sks as Array<{ skill_id: string; level: number | null }> | null) ?? []).map((r) => r.skill_id));

  // Load available categories / skills for selection
  const [{ data: catRows }, { data: skillRows }] = await Promise.all([
    supabase.from("service_categories").select("id,name,parent_id").order("name", { ascending: true }),
    supabase.from("skills").select("id,name").order("name", { ascending: true }),
  ]);
  const categories: Category[] = (catRows as Category[] | null) ?? [];
  const skills: Skill[] = (skillRows as Skill[] | null) ?? [];

  // Group categories by parent for basic hierarchy
  const byParent = new Map<string | null, Category[]>();
  for (const c of categories) {
    const arr = byParent.get(c.parent_id) ?? [];
    arr.push(c);
    byParent.set(c.parent_id, arr);
  }

  const langString = (profile?.languages ?? []).join(", ");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Let’s get you set up</h1>
        <Link href="/profile" className="text-sm text-blue-600 hover:underline">Skip</Link>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <form action={saveOnboarding} className="space-y-6">
            <input type="hidden" name="next" value={next} />

            {/* Account basics */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Basic info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="display_name" className="block text-sm text-muted-foreground">Display name</label>
                  <input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Your name or business" />
                </div>
                <div>
                  <label htmlFor="headline" className="block text-sm text-muted-foreground">Headline</label>
                  <input id="headline" name="headline" defaultValue={profile?.headline ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="e.g., Full-stack developer" />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="bio" className="block text-sm text-muted-foreground">Bio</label>
                  <textarea id="bio" name="bio" rows={5} defaultValue={profile?.bio ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Tell us about your experience…"></textarea>
                </div>
              </div>
            </div>

            {/* Location & prefs */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Location & preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="country" className="block text-sm text-muted-foreground">Country</label>
                  <input id="country" name="country" defaultValue={profile?.country ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Algeria" />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm text-muted-foreground">City</label>
                  <input id="city" name="city" defaultValue={profile?.city ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Algiers" />
                </div>
                <div>
                  <label htmlFor="timezone" className="block text-sm text-muted-foreground">Timezone</label>
                  <input id="timezone" name="timezone" defaultValue={profile?.timezone ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Africa/Algiers" />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="website" className="block text-sm text-muted-foreground">Website</label>
                  <input id="website" name="website" defaultValue={profile?.website ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="https://…" />
                </div>
                <div>
                  <label htmlFor="languages" className="block text-sm text-muted-foreground">Languages (comma-separated)</label>
                  <input id="languages" name="languages" defaultValue={langString} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="ar, fr" />
                </div>
              </div>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">How will you use Skilink?</h2>
              <div className="rounded-md border p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2" htmlFor="is_provider">
                  <input id="is_provider" type="checkbox" name="is_provider" defaultChecked={me.is_provider || !!provider} />
                  <span className="text-sm">I want to offer services (provider)</span>
                </label>
                <div className="md:col-span-2 text-xs text-muted-foreground">
                  You can change this later in Settings.
                </div>
              </div>
            </div>

            {/* Provider details */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Provider details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="hourly_rate" className="block text-sm text-muted-foreground">Hourly rate (DZD)</label>
                  <input id="hourly_rate" name="hourly_rate" defaultValue={provider?.hourly_rate ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="min_project_value" className="block text-sm text-muted-foreground">Min project (DZD)</label>
                  <input id="min_project_value" name="min_project_value" defaultValue={provider?.min_project_value ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
                </div>
                <div>
                  <label htmlFor="years_experience" className="block text-sm text-muted-foreground">Years experience</label>
                  <input id="years_experience" name="years_experience" defaultValue={provider?.years_experience ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" />
                </div>
                <label className="flex items-center gap-2" htmlFor="remote">
                  <input id="remote" type="checkbox" name="remote" defaultChecked={provider?.remote ?? true} />
                  <span className="text-sm">Available remote</span>
                </label>
                <label className="flex items-center gap-2" htmlFor="on_site">
                  <input id="on_site" type="checkbox" name="on_site" defaultChecked={provider?.on_site ?? false} />
                  <span className="text-sm">Available on-site</span>
                </label>
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Services (categories)</h2>
              {byParent.get(null)?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[420px] overflow-auto rounded-md border p-2">
                  {byParent.get(null)!.map((top) => {
                    const children = byParent.get(top.id) ?? [];
                    return (
                      <div key={top.id} className="rounded-md border p-3">
                        <div className="font-medium">{top.name}</div>
                        <div className="mt-2 grid grid-cols-1 gap-1">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="categories" value={top.id} defaultChecked={myCatIds.has(top.id)} />
                            <span className="text-sm">{top.name}</span>
                          </label>
                          {children.map((ch) => (
                            <label key={ch.id} className="flex items-center gap-2 pl-5">
                              <input type="checkbox" name="categories" value={ch.id} defaultChecked={myCatIds.has(ch.id)} />
                              <span className="text-sm">{ch.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">No categories available.</div>
              )}
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Skills</h2>
              {skills.length ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-[300px] overflow-auto rounded-md border p-2">
                  {skills.map((sk) => (
                    <label key={sk.id} className="flex items-center gap-2">
                      <input type="checkbox" name="skills" value={sk.id} defaultChecked={mySkillIds.has(sk.id)} />
                      <span className="text-sm">{sk.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">No skills available.</div>
              )}
              <p className="text-xs text-muted-foreground">Tip: skill levels default to 3/5. You can fine-tune later.</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <Link href="/profile" className="rounded-md border px-4 py-2 text-center">Cancel</Link>
              <button className="rounded-md bg-black px-4 py-2 text-white">Save & continue</button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
