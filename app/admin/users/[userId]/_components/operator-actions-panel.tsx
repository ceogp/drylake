"use client";

import { useActionState, useState } from "react";

import { suspendUserAction, reactivateUserAction, overrideTierAction } from "@/app/admin/actions";
import { StatusBadge } from "@/app/admin/_components/admin-ui";

type ConfirmAction = "suspend" | "reactivate" | "tier_override" | null;
type TierActionState = { error: string } | undefined;

export function OperatorActionsPanel({
  userId,
  userEmail,
  userStatus,
  orgId,
  orgTier,
  stripeSubscriptionId,
}: {
  userId: string;
  userEmail: string;
  userStatus: string;
  orgId: string | undefined;
  orgTier: string | undefined;
  stripeSubscriptionId: string | null | undefined;
}) {
  const currentTier = orgTier ?? "free";
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [selectedTier, setSelectedTier] = useState(currentTier);
  const [tierError, setTierError] = useState<string | null>(null);
  const [, tierFormAction, isTierPending] = useActionState(
    async (_previousState: TierActionState, formData: FormData) => {
      const result = await overrideTierAction(formData);

      if (result?.error) {
        setTierError(result.error);
        setConfirmAction(null);
      }

      return result;
    },
    undefined,
  );

  const tierNote = stripeSubscriptionId
    ? "Override tier in DB. Stripe subscription set to cancel at period end."
    : "Override tier in DB. No Stripe subscription is linked.";
  const canOverrideTier = Boolean(orgId) && selectedTier !== currentTier;

  return (
    <section>
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-amber-800">Operator Actions</p>
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-col gap-4 border-b border-amber-100 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-950">
              Account Status <StatusBadge value={userStatus} />
            </p>
            <p className="mt-1 text-xs text-stone-500">Suspending prevents sign-in and platform use.</p>
          </div>
          {userStatus === "active" ? (
            <button
              className="inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setConfirmAction("suspend")}
              type="button"
            >
              Suspend Account
            </button>
          ) : (
            <button
              className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setConfirmAction("reactivate")}
              type="button"
            >
              Reactivate Account
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex flex-wrap items-center gap-2 font-semibold text-stone-950">
              Organization Tier <StatusBadge value={currentTier} />
            </p>
            <p className="mt-1 text-xs text-stone-500">{tierNote}</p>
            {tierError ? <p className="mt-1 text-xs text-red-700">{tierError}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm"
              onChange={(event) => {
                setSelectedTier(event.target.value);
                setTierError(null);
              }}
              value={selectedTier}
            >
              <option value="free">free</option>
              <option value="pro">pro</option>
              <option value="enterprise">enterprise</option>
            </select>
            <button
              className="inline-flex items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canOverrideTier}
              onClick={() => setConfirmAction("tier_override")}
              type="button"
            >
              Override Tier
            </button>
          </div>
        </div>
      </div>

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-7 shadow-xl">
            {confirmAction === "suspend" ? (
              <form action={suspendUserAction}>
                <h2 className="text-xl font-semibold text-stone-950">Suspend Account</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  This will suspend {userEmail} and prevent sign-in or platform use.
                </p>
                <input name="userId" type="hidden" value={userId} />
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
                    onClick={() => setConfirmAction(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md border border-red-200 bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                    type="submit"
                  >
                    Confirm Suspend
                  </button>
                </div>
              </form>
            ) : null}

            {confirmAction === "reactivate" ? (
              <form action={reactivateUserAction}>
                <h2 className="text-xl font-semibold text-stone-950">Reactivate Account</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  This will restore active access for {userEmail}.
                </p>
                <input name="userId" type="hidden" value={userId} />
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
                    onClick={() => setConfirmAction(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md border border-stone-300 bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
                    type="submit"
                  >
                    Confirm Reactivate
                  </button>
                </div>
              </form>
            ) : null}

            {confirmAction === "tier_override" ? (
              <form action={tierFormAction}>
                <h2 className="text-xl font-semibold text-stone-950">Override Tier</h2>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  This will change the organization tier from {currentTier} to {selectedTier} and set the
                  Stripe subscription to cancel at period end when available.
                </p>
                <input name="userId" type="hidden" value={userId} />
                <input name="orgId" type="hidden" value={orgId ?? ""} />
                <input name="newTier" type="hidden" value={selectedTier} />
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-100"
                    disabled={isTierPending}
                    onClick={() => setConfirmAction(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-md border border-stone-300 bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isTierPending}
                    type="submit"
                  >
                    {isTierPending ? "Overriding..." : "Confirm Override"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
