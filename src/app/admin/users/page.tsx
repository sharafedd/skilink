// src/app/(admin)/users/page.tsx
import Link from "next/link";
import { createSupabaseServerRO } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type SearchParams = {
  q?: string;
  role?: "buyer" | "provider" | "admin";
  page?: string;
};

const PAGE_SIZE = 20;

function roleBadge(role: string) {
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  // If you're using shadcn Badge, "outline" is a valid variant.
  const variant: "outline" | undefined = role === "admin" ? "outline" : undefined;
  return <Badge variant={variant}>{label}</Badge>;
}


function buildQueryString(
  params: Record<string, string | undefined>,
  updates: Record<string, string | undefined>
) {
  const merged = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...updates })) {
    if (v && v.length) merged.set(k, v);
  }
  // reset page when filters/search change
  if (updates.q !== undefined || updates.role !== undefined) merged.set("page", "1");
  const s = merged.toString();
  return s ? `?${s}` : "";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createSupabaseServerRO();

  const q = (searchParams?.q ?? "").trim();
  const role = (searchParams?.role as SearchParams["role"]) || undefined;
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("users")
    .select("id,email,role,is_provider,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q) query = query.ilike("email", `%${q}%`);
  if (role) query = query.eq("role", role);

  const { data: users, count, error } = await query;

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Users</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          Failed to load users: {error.message}
        </div>
      </div>
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const currentParams: Record<string, string | undefined> = {
    q: q || undefined,
    role: role || undefined,
    page: String(page),
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Users</h1>

      {/* Filters / Search */}
      <Card>
        <CardContent className="p-4">
          {/* Plain GET form: updates URL with search params */}
          <form
            action="/admin/users"
            method="GET"
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <div className="flex items-center gap-2">
              <label htmlFor="q" className="text-sm text-muted-foreground w-20">
                Search
              </label>
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Search email…"
                className="w-full rounded-md border px-3 py-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="role" className="text-sm text-muted-foreground w-20">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={role || ""}
                className="w-full rounded-md border px-3 py-2 bg-white"
              >
                <option value="">All</option>
                <option value="buyer">Buyer</option>
                <option value="provider">Provider</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex items-center gap-2 md:justify-end">
              <Link
                href={`/admin/users${buildQueryString(currentParams, { q: "", role: "", page: "1" })}`}
                className="rounded-md border px-3 py-2"
              >
                Reset
              </Link>
              <button
                type="submit"
                className="rounded-md bg-black text-white px-3 py-2"
              >
                Apply
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{users?.length ?? 0}</span> of{" "}
        <span className="font-medium">{total}</span> users
        {q ? <> for query <span className="font-medium">&ldquo;{q}&rdquo;</span></> : null}
        {role ? <> with role <span className="font-medium">{role}</span></> : null}.
      </div>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[42%]">Email</TableHead>
                <TableHead className="w-[18%]">Role</TableHead>
                <TableHead className="w-[20%]">Is Provider</TableHead>
                <TableHead className="w-[20%]">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users && users.length > 0 ? (
                users.map((u: { id: string; email: string | null; role: string; is_provider: boolean; created_at: string }) => (
                  <TableRow key={u.id}>
                    <TableCell className="truncate">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-blue-600 hover:underline"
                        prefetch={false}
                      >
                        {u.email ?? "(no email)"}
                      </Link>
                    </TableCell>
                    <TableCell>{roleBadge(u.role)}</TableCell>
                    <TableCell>{u.is_provider ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                    <TableCell>{new Date(u.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page <span className="font-medium">{page}</span> of{" "}
          <span className="font-medium">{totalPages}</span>
        </div>
        <div className="flex gap-2">
          <Link
            href={
              page > 1
                ? `/admin/users${buildQueryString(currentParams, { page: String(page - 1) })}`
                : "#"
            }
            aria-disabled={page <= 1}
            className={`rounded-md border px-3 py-2 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Previous
          </Link>
          <Link
            href={
              page < totalPages
                ? `/admin/users${buildQueryString(currentParams, { page: String(page + 1) })}`
                : "#"
            }
            aria-disabled={page >= totalPages}
            className={`rounded-md border px-3 py-2 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
