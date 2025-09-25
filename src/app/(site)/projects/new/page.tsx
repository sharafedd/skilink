// src/app/(site)/projects/new/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

type AppUser = { id: string; auth_id: string | null; email: string | null };
type Category = { id: string; slug: string; name: string; parent_id: string | null };

async function resolveOrCreateAppUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerRO>>,
  authId: string,
  email: string | null
): Promise<AppUser | null> {
  const { data: byAuth } = await supabase
    .from("users")
    .select("id,auth_id,email")
    .eq("auth_id", authId)
    .limit(1)
    .maybeSingle();
  if (byAuth) return byAuth as AppUser;

  if (email) {
    const { data: byEmail } = await supabase
      .from("users")
      .select("id,auth_id,email")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    const row = byEmail as AppUser | null;
    if (row) {
      await supabase.from("users").update({ auth_id: authId, updated_at: new Date().toISOString() }).eq("id", row.id);
      return { id: row.id, auth_id: authId, email: row.email };
    }
  }

  if (!email) return null;

  const { data: created } = await supabase
    .from("users")
    .insert({ email, auth_id: authId, role: "buyer", is_provider: false })
    .select("id,auth_id,email")
    .single();

  return (created as AppUser | null) ?? null;
}

/* ================= Server Action ================= */
async function createProject(formData: FormData) {
  "use server";
  const supabase = await createSupabaseServerRO();
  const auth = await getCurrentUser();
  if (!auth) return redirect("/login");

  const me = await resolveOrCreateAppUser(supabase, auth.id, auth.email ?? null);
  if (!me) return redirect("/login");

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;

  const budget_kindRaw = String(formData.get("budget_kind") || "fixed");
  const budget_kind = budget_kindRaw === "hourly" ? "hourly" : "fixed";

  const budget_amountRaw = Number(String(formData.get("budget_amount") || "").trim());
  const hourly_minRaw = Number(String(formData.get("hourly_min") || "").trim());
  const hourly_maxRaw = Number(String(formData.get("hourly_max") || "").trim());

  const budget_amount = Number.isFinite(budget_amountRaw) ? budget_amountRaw : null;
  const hourly_min = Number.isFinite(hourly_minRaw) ? hourly_minRaw : null;
  const hourly_max = Number.isFinite(hourly_maxRaw) ? hourly_maxRaw : null;

  const location_typeRaw = String(formData.get("location_type") || "remote");
  const location_type =
    location_typeRaw === "on-site" || location_typeRaw === "hybrid" ? location_typeRaw : "remote";

  const country = String(formData.get("country") || "").trim() || null;
  const city = String(formData.get("city") || "").trim() || null;
  const address_line = String(formData.get("address_line") || "").trim() || null;
  const due_dateStr = String(formData.get("due_date") || "").trim();
  const due_date = due_dateStr ? due_dateStr : null;

  const allow_providers_outside_country = formData.get("allow_external") === "on";

  const publish = String(formData.get("publish") || "") === "1";
  const status: "draft" | "open" = publish ? "open" : "draft";

  const inviteProviderId = String(formData.get("invite_provider_id") || "");

  if (!title) return redirect("/projects/new");

  // Basic server-side validation for budget fields
  if (budget_kind === "fixed" && budget_amount == null) {
    return redirect("/projects/new?err=budget");
  }
  if (budget_kind === "hourly" && (hourly_min == null || hourly_max == null || hourly_min > hourly_max)) {
    return redirect("/projects/new?err=hourly");
  }

  // Insert project
  const { data: inserted } = await supabase
    .from("projects")
    .insert({
      buyer_id: me.id,
      title,
      description,
      status,
      budget_kind,
      budget_amount: budget_kind === "fixed" ? budget_amount : null,
      hourly_min: budget_kind === "hourly" ? hourly_min : null,
      hourly_max: budget_kind === "hourly" ? hourly_max : null,
      location_type,
      country,
      city,
      address_line,
      due_date,
      allow_providers_outside_country: allow_providers_outside_country,
    })
    .select("id")
    .single();

  const projectId = (inserted as { id: string } | null)?.id;
  if (!projectId) return redirect("/projects/new?err=failed");

  // Link categories (if any)
  const categories = formData.getAll("categories").map(String).filter(Boolean); // array of category_id
  if (categories.length) {
    const rows = categories.map((cid) => ({ project_id: projectId, category_id: cid }));
    await supabase.from("project_categories").insert(rows);
  }

  revalidatePath("/projects");
  if (inviteProviderId) {
    return redirect(`/providers/${encodeURIComponent(inviteProviderId)}/invite`);
  }
  return redirect(`/projects`);
}

/* ================= Page ================= */

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams?: { invite?: string | string[]; err?: string };
}) {
  const [auth, supabase] = await Promise.all([getCurrentUser(), createSupabaseServerRO()]);
  if (!auth) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-3xl font-bold">Create a project</h1>
        <Card>
          <CardContent className="p-6 text-sm">
            Please{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              sign in
            </Link>{" "}
            to create a project.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Load categories for selection
  const { data: cats } = await supabase
    .from("service_categories")
    .select("id,slug,name,parent_id")
    .order("name", { ascending: true });

  const categories: Category[] = (cats as Category[] | null) ?? [];
  const byParent = new Map<string | null, Category[]>();
  for (const c of categories) {
    const k = c.parent_id;
    const arr = byParent.get(k) ?? [];
    arr.push(c);
    byParent.set(k, arr);
  }

  const inviteProviderId =
    typeof searchParams?.invite === "string" ? searchParams!.invite : Array.isArray(searchParams?.invite) ? searchParams!.invite[0] : "";

  const err = searchParams?.err;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Create a project</h1>
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">
          Back to projects
        </Link>
      </div>

      {err ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err === "budget" && "Please provide a valid fixed budget amount."}
          {err === "hourly" && "Please provide a valid hourly range (min ≤ max)."}
          {err === "failed" && "Something went wrong while creating your project."}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-6 space-y-5">
          <form action={createProject} className="space-y-5">
            {inviteProviderId ? (
              <input type="hidden" name="invite_provider_id" value={inviteProviderId} />
            ) : null}

            {/* Basics */}
            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground">Title</label>
              <input
                name="title"
                required
                placeholder="e.g., Build a modern company website"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-muted-foreground">Description</label>
              <textarea
                name="description"
                rows={6}
                placeholder="Describe scope, deliverables, timeline…"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            {/* Budget */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="block text-sm text-muted-foreground">Budget type</label>
                <select name="budget_kind" defaultValue="fixed" className="mt-1 w-full rounded-md border px-3 py-2 bg-white">
                  <option value="fixed">Fixed</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-muted-foreground">Fixed amount (DZD)</label>
                <input name="budget_amount" placeholder="e.g., 120000" className="mt-1 w-full rounded-md border px-3 py-2" />
              </div>
              <div className="md:col-span-1 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-muted-foreground">Hourly min</label>
                  <input name="hourly_min" placeholder="e.g., 1500" className="mt-1 w-full rounded-md border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground">Hourly max</label>
                  <input name="hourly_max" placeholder="e.g., 3000" className="mt-1 w-full rounded-md border px-3 py-2" />
                </div>
              </div>
            </div>

            {/* Timing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="block text-sm text-muted-foreground">Due date</label>
                <input type="date" name="due_date" className="mt-1 w-full rounded-md border px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-muted-foreground">Location</label>
                <div className="mt-1 flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="location_type" value="remote" defaultChecked /> <span className="text-sm">Remote</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="location_type" value="on-site" /> <span className="text-sm">On-site</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="location_type" value="hybrid" /> <span className="text-sm">Hybrid</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Address (optional) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-muted-foreground">Country</label>
                <input name="country" placeholder="Algeria" className="mt-1 w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground">City</label>
                <input name="city" placeholder="Algiers" className="mt-1 w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground">Address (optional)</label>
                <input name="address_line" className="mt-1 w-full rounded-md border px-3 py-2" />
              </div>
            </div>

            {/* External providers */}
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allow_external" defaultChecked />
              <span className="text-sm">Allow providers outside the selected country</span>
            </label>

            {/* Categories */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Categories</div>
              {byParent.get(null)?.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {byParent.get(null)!.map((top) => {
                    const children = byParent.get(top.id) ?? [];
                    return (
                      <div key={top.id} className="rounded-md border p-3">
                        <label className="font-medium">{top.name}</label>
                        <div className="mt-2 grid grid-cols-1 gap-1">
                          <label className="flex items-center gap-2">
                            <input type="checkbox" name="categories" value={top.id} /> <span className="text-sm">{top.name}</span>
                          </label>
                          {children.map((ch) => (
                            <label key={ch.id} className="flex items-center gap-2 pl-5">
                              <input type="checkbox" name="categories" value={ch.id} /> <span className="text-sm">{ch.name}</span>
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

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <Link href="/projects" className="rounded-md border px-4 py-2">
                Cancel
              </Link>
              <button
                name="publish"
                value="0"
                className="rounded-md border px-4 py-2"
                aria-label="Save as draft"
              >
                Save draft
              </button>
              <button
                name="publish"
                value="1"
                className="rounded-md bg-black px-4 py-2 text-white"
                aria-label="Publish project"
              >
                Publish
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
