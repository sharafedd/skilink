// src/app/(admin)/settings/page.tsx
import { revalidatePath } from "next/cache";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { createSupabaseServerAdmin } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// ---- Types ----
type Category = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type Skill = { id: string; slug: string; name: string };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg sm:text-xl font-semibold">{children}</h2>;
}

/* -------------------- Server Actions (CRUD) -------------------- */

export async function addCategory(formData: FormData) {
  "use server";
  const supabase = createSupabaseServerAdmin();
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const parent_id = (formData.get("parent_id") as string) || null;
  if (!name || !slug) return;
  await supabase.from("service_categories").insert({ name, slug, parent_id: parent_id || null });
  revalidatePath("/admin/settings");
}

export async function renameCategory(formData: FormData) {
  "use server";
  const supabase = createSupabaseServerAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  await supabase.from("service_categories").update({ name }).eq("id", id);
  revalidatePath("/admin/settings");
}

export async function deleteCategory(formData: FormData) {
  "use server";
  const supabase = createSupabaseServerAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase.from("service_categories").delete().eq("id", id);
  revalidatePath("/admin/settings");
}

export async function addSkill(formData: FormData) {
  "use server";
  const supabase = createSupabaseServerAdmin();
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  if (!name || !slug) return;
  await supabase.from("skills").insert({ name, slug });
  revalidatePath("/admin/settings");
}

export async function renameSkill(formData: FormData) {
  "use server";
  const supabase = createSupabaseServerAdmin();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  await supabase.from("skills").update({ name }).eq("id", id);
  revalidatePath("/admin/settings");
}

export async function deleteSkill(formData: FormData) {
  "use server";
  const supabase = createSupabaseServerAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await supabase.from("skills").delete().eq("id", id);
  revalidatePath("/admin/settings");
}

/* -------------------- Page -------------------- */

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerRO();

  const [{ data: categories }, { data: skills }] = await Promise.all([
    supabase
      .from("service_categories")
      .select("id,parent_id,slug,name,sort_order,created_at,updated_at")
      .order("created_at", { ascending: true }),
    supabase.from("skills").select("id,slug,name").order("name", { ascending: true }),
  ]);

  const cats = (categories as Category[] | null) ?? [];
  const skillRows = (skills as Skill[] | null) ?? [];

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold">Platform Settings</h1>

      {/* CATEGORIES */}
      <section className="space-y-4">
        <SectionTitle>Service Categories</SectionTitle>

        {/* Add category */}
        <Card>
          <CardContent className="p-4">
            <form action={addCategory} className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2 md:col-span-2">
                <label htmlFor="cat-name" className="text-xs md:text-sm text-muted-foreground md:w-20">Name</label>
                <input id="cat-name" name="name" placeholder="e.g., Plumbing" className="w-full rounded-md border px-3 py-2 text-sm md:text-base" required />
              </div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label htmlFor="cat-slug" className="text-xs md:text-sm text-muted-foreground md:w-20">Slug</label>
                <input id="cat-slug" name="slug" placeholder="plumbing" className="w-full rounded-md border px-3 py-2 text-sm md:text-base" required />
              </div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label htmlFor="cat-parent" className="text-xs md:text-sm text-muted-foreground md:w-20">Parent</label>
                <select id="cat-parent" name="parent_id" className="w-full rounded-md border px-3 py-2 bg-white text-sm md:text-base">
                  <option value="">(none)</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-4 flex justify-end">
                <button type="submit" className="rounded-md bg-black px-3 py-2 text-white text-sm md:text-base">Add Category</button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* List / manage */}
        <Card>
          <CardContent className="p-0">
            {/* Mobile list */}
            <div className="sm:hidden divide-y">
              {cats.length ? (
                cats.map((c) => {
                  const parent = cats.find((p) => p.id === c.parent_id);
                  return (
                    <div key={c.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{c.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Slug: {c.slug} · Parent: {parent ? parent.name : "—"}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={renameCategory} className="flex gap-2">
                          <input type="hidden" name="id" value={c.id} />
                          <input name="name" placeholder="New name" className="w-40 rounded-md border px-2 py-1 text-sm" aria-label="New name" />
                          <button className="rounded-md border px-2 py-1 text-sm">Rename</button>
                        </form>
                        <form action={deleteCategory}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="rounded-md border px-2 py-1 text-red-600 text-sm" aria-label="Delete category">Delete</button>
                        </form>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">No categories yet.</div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">Name</TableHead>
                    <TableHead className="w-[20%]">Slug</TableHead>
                    <TableHead className="w-[30%]">Parent</TableHead>
                    <TableHead className="w-[22%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cats.length ? (
                    cats.map((c) => {
                      const parent = cats.find((p) => p.id === c.parent_id);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="truncate">{c.name}</TableCell>
                          <TableCell className="truncate">{c.slug}</TableCell>
                          <TableCell className="truncate">{parent ? parent.name : "—"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <form action={renameCategory} className="flex gap-2">
                                <input type="hidden" name="id" value={c.id} />
                                <input name="name" placeholder="New name" className="rounded-md border px-2 py-1 text-sm" aria-label="New name" />
                                <button className="rounded-md border px-2 py-1 text-sm">Rename</button>
                              </form>
                              <form action={deleteCategory} className="ml-2">
                                <input type="hidden" name="id" value={c.id} />
                                <button className="rounded-md border px-2 py-1 text-red-600 text-sm" aria-label="Delete category">Delete</button>
                              </form>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No categories yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* SKILLS */}
      <section className="space-y-4">
        <SectionTitle>Skills</SectionTitle>

        {/* Add skill */}
        <Card>
          <CardContent className="p-4">
            <form action={addSkill} className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label htmlFor="skill-name" className="text-xs md:text-sm text-muted-foreground md:w-20">Name</label>
                <input id="skill-name" name="name" placeholder="e.g., Welding" className="w-full rounded-md border px-3 py-2 text-sm md:text-base" required />
              </div>
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <label htmlFor="skill-slug" className="text-xs md:text-sm text-muted-foreground md:w-20">Slug</label>
                <input id="skill-slug" name="slug" placeholder="welding" className="w-full rounded-md border px-3 py-2 text-sm md:text-base" required />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button type="submit" className="rounded-md bg-black px-3 py-2 text-white text-sm md:text-base">Add Skill</button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* List / manage */}
        <Card>
          <CardContent className="p-0">
            {/* Mobile list */}
            <div className="sm:hidden divide-y">
              {skillRows.length ? (
                skillRows.map((s) => (
                  <div key={s.id} className="p-3">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Slug: {s.slug}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={renameSkill} className="flex gap-2">
                        <input type="hidden" name="id" value={s.id} />
                        <input name="name" placeholder="New name" className="w-40 rounded-md border px-2 py-1 text-sm" aria-label="New name" />
                        <button className="rounded-md border px-2 py-1 text-sm">Rename</button>
                      </form>
                      <form action={deleteSkill}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="rounded-md border px-2 py-1 text-red-600 text-sm" aria-label="Delete skill">Delete</button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">No skills yet.</div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Name</TableHead>
                    <TableHead className="w-[40%]">Slug</TableHead>
                    <TableHead className="w-[20%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skillRows.length ? (
                    skillRows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="truncate">{s.name}</TableCell>
                        <TableCell className="truncate">{s.slug}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <form action={renameSkill} className="flex gap-2">
                              <input type="hidden" name="id" value={s.id} />
                              <input name="name" placeholder="New name" className="rounded-md border px-2 py-1 text-sm" aria-label="New name" />
                              <button className="rounded-md border px-2 py-1 text-sm">Rename</button>
                            </form>
                            <form action={deleteSkill} className="ml-2">
                              <input type="hidden" name="id" value={s.id} />
                              <button className="rounded-md border px-2 py-1 text-red-600 text-sm" aria-label="Delete skill">Delete</button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No skills yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
