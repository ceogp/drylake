import { redirect } from "next/navigation";

import { AppHome } from "@/components/app-home";
import { getStarterWorkspaceRedirectPath } from "@/lib/services/workspace";

export default async function AppPage() {
  const starterWorkspacePath = await getStarterWorkspaceRedirectPath();

  if (starterWorkspacePath) {
    redirect(starterWorkspacePath);
  }

  return <AppHome />;
}
