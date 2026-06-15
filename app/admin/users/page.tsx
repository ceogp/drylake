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

type UserProfileSummary = {
  phoneNumber?: string | null;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
} | null | undefined;

function compactText(parts: Array<string | null | undefined>, fallback = "n/a") {
  const text = parts.map((part) => part?.trim()).filter(Boolean).join(", ");
  return text || fallback;
}

function formatProfileLocation(profile: UserProfileSummary) {
  return compactText([profile?.city, profile?.region, profile?.postalCode, profile?.country]);
}

function formatProfileAddress(profile: UserProfileSummary) {
  return compactText([profile?.addressLine1, profile?.addressLine2], "");
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
    <AdminShell title="Users" subtitle="Signed-up accounts, profile capture, auth activity, sessions, and plan state.">
      <div className="flex flex-wrap items-center gap-3">
        <Link className="text-sm font-medium text-stone-700 hover:text-stone-950" href="/portal">
          Back to overview
        </Link>
        <Link
          className="rounded-md border border-stone-300 bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          href="/api/v1/portal/users/export"
        >
          Export Users CSV
        </Link>
        <Link
          className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
          href="/api/v1/portal/skills/export"
        >
          Export All AI Content CSV
        </Link>
      </div>

      <form className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end" method="GET">
        <label className="flex-1 text-sm font-medium text-stone-700">
          <span className="font-mono text-xs uppercase tracking-[0.12em] text-stone-500">Email</span>
          <input
            className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
            defaultValue={search ?? ""}
            name="search"
            placeholder="Filter by email..."
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
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Auth Tracking</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Activity</th>
                  <th className="px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const latestAuthEvent = user.authEvents[0];
                  const latestSession = user.appSessions[0];
                  const primaryMembership = user.memberships[0];
                  const organization = primaryMembership?.organization;
                  const subscription = organization?.subscriptions[0];
                  const plan = subscription?.tier ?? organization?.tier ?? "free";
                  const subscriptionStatus = subscription?.status ?? (organization ? "free" : "none");

                  return (
                    <tr className="border-b border-stone-100 align-top" key={user.id}>
                      <td className="px-3 py-4">
                        <Link className="font-medium text-stone-950 hover:underline" href={`/portal/users/${user.id}`}>
                          {user.profile?.displayName ?? user.email}
                        </Link>
                        <div className="text-xs text-stone-500">{user.email}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <StatusBadge value={user.status} />
                          <span className="inline-flex rounded-md border border-stone-200 bg-stone-50 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-stone-600">
                            {user.authProvider}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-xs leading-6 text-stone-600">
                        <div>Phone: {user.profile?.phoneNumber ?? "n/a"}</div>
                        <div>Location: {formatProfileLocation(user.profile)}</div>
                        <div>Intent: {user.profile?.signupPlanIntent ?? "unknown"}</div>
                        <div>Onboarded: {user.profile?.onboardingCompletedAt ? formatDate(user.profile.onboardingCompletedAt) : "no"}</div>
                        {formatProfileAddress(user.profile) ? (
                          <div>Address: {formatProfileAddress(user.profile)}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 text-xs leading-6 text-stone-600">
                        {latestAuthEvent ? (
                          <>
                            <div className="font-medium text-stone-950">{latestAuthEvent.eventName}</div>
                            <div>{latestAuthEvent.authProvider ?? user.authProvider}</div>
                            <StatusBadge value={latestAuthEvent.success ? "success" : "failed"} />
                            {latestAuthEvent.failureReason ? (
                              <div className="mt-1 text-red-700">{latestAuthEvent.failureReason}</div>
                            ) : null}
                            <div className="text-stone-500">{formatDate(latestAuthEvent.createdAt)}</div>
                          </>
                        ) : (
                          <span className="text-stone-500">No auth events</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-xs leading-6 text-stone-600">
                        <div className="font-medium text-stone-950">{organization?.name ?? "No organization"}</div>
                        <div>Role: {primaryMembership?.role ?? "n/a"}</div>
                        <div>Tier: {plan}</div>
                        <div>Status: {subscriptionStatus}</div>
                      </td>
                      <td className="px-3 py-4 text-xs leading-6 text-stone-600">
                        <div>Memberships: {user._count.memberships}</div>
                        <div>Sessions: {user._count.appSessions}</div>
                        <div>Auth events: {user._count.authEvents}</div>
                        {latestSession ? (
                          <div>Last session: {formatDate(latestSession.lastSeenAt)}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 text-xs text-stone-500">{formatDate(user.createdAt)}</td>
                    </tr>
                  );
                })}
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
              Page {currentPage} - {totalCount} total
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
