import { redirect } from "next/navigation";

import { AppHome } from "@/components/app-home";
import { getPrimaryWorkspacePath } from "@/lib/services/workspace";

export default async function AppPage() {
  const workspacePath = await getPrimaryWorkspacePath();

  if (workspacePath) {
    redirect(workspacePath);
  }

  return <AppHome />;
}
