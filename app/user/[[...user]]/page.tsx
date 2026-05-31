import { redirect } from "next/navigation";

export default async function LegacyUserPage({
  params,
}: {
  params: Promise<{ user?: string[] }>;
}) {
  const { user } = await params;
  const firstSegment = user?.[0]?.toLowerCase();

  if (firstSegment === "billing" || firstSegment === "plans" || firstSegment === "subscription") {
    redirect("/billing");
  }

  redirect("/account");
}
