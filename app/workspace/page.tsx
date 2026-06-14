import { redirect } from "next/navigation";
import { requireCompletedOnboardingAppContextForPage } from "@/lib/services/current-user";
import { getPrimaryWorkspacePath } from "@/lib/services/workspace";

export default async function WorkspacePage() {
  await requireCompletedOnboardingAppContextForPage("/workspace");
  const workspacePath = await getPrimaryWorkspacePath();
  redirect(workspacePath ?? "/upload");
}
