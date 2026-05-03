import Link from "next/link";

import {
  AdminShell,
  EmptyState,
  Panel,
  StatusBadge,
  formatDate,
} from "@/app/admin/_components/admin-ui";
import { requireAdminPageAccess } from "@/app/admin/_lib/access";
import { getAdminUsersListData } from "@/lib/services/admin-data";

function getPageHref(page: number, search?: string) {
  return `?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  await requireAdminPageAccess();

  const { page: rawPage, search: rawSearch } = await searchParams;
  const parsedPage = Math.max(1, parseInt(rawPage ?? "1", 10));
  const page = Number.isNaN(parsedPage) ? 1 : parsedPage;
  const search = rawSearch?.trim() || undefined;
  const {
    users,
    totalCount,
    hasNextPage,
    hasPrevPage,
    page: currentPage,
  } = await getAdminUsersListData(page, search);

  return (
    <AdminShell title="Users" subtitle="All registered accounts — paginated and searchable by email.">
      <div>
        <Link className="text-sm font-medium text-stone-700 hover:text-stone-950" href="/admin">
          ← Overview
        </Link>
      </div>

      <form className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end" method="GET">
        <label className="flex-1 text-sm font-medium text-stone-700">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Email</span>
          <input
            className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
            defaultValue={search ?? ""}
            name="search"
            placeholder="Filter by email…"
            type="text"
          />
        </label>
        <input name="page" type="hidden" value="1" />
        <button
          className="rounded-md border border-stone-300 bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          type="submit"
        >
          Search
        </button>
      </form>

      <Panel eyebrow="Accounts" title="All Users">
        {users.length === 0 ? (
          <EmptyState>No users found{search ? ` matching "${search}"` : ""}.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-stone-700">
              <thead className="border-b border-stone-200 font-mono text-xs uppercase tracking-[0.12em] text-stone-500">
                <tr>
                  <th className="px-3 py-3">User</th>
                  <th className="px-3 py-3">Auth Provider</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Memberships</th>
                  <th className="px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr className="border-b border-stone-100 align-top" key={user.id}>
                    <td className="px-3 py-4">
                      <Link className="font-medium text-stone-950 hover:underline" href={`/admin/users/${user.id}`}>
                        {user.profile?.displayName ?? user.email}
                      </Link>
                      <div className="text-xs text-stone-500">{user.email}</div>
                    </td>
                    <td className="px-3 py-4">{user.authProvider}</td>
                    <td className="px-3 py-4">
                      <StatusBadge value={user.status} />
                    </td>
                    <td className="px-3 py-4">{user._count.memberships}</td>
                    <td className="px-3 py-4 text-xs text-stone-500">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasPrevPage || hasNextPage ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
            {hasPrevPage ? (
              <Link
                className="rounded-md border border-stone-300 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
                href={getPageHref(currentPage - 1, search)}
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-md border border-stone-200 bg-stone-50 px-4 py-2 font-medium text-stone-400">
                Previous
              </span>
            )}
            <div className="text-stone-600">
              Page {currentPage} · {totalCount} total
            </div>
            {hasNextPage ? (
              <Link
                className="rounded-md border border-stone-300 bg-white px-4 py-2 font-medium text-stone-900 transition hover:bg-stone-100"
                href={getPageHref(currentPage + 1, search)}
              >
                Next
              </Link>
            ) : (
              <span className="rounded-md border border-stone-200 bg-stone-50 px-4 py-2 font-medium text-stone-400">
                Next
              </span>
            )}
          </div>
        ) : null}
      </Panel>
    </AdminShell>
  );
}
