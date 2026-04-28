import { redirect } from "next/navigation";
import { getPrimaryWorkspacePath } from "@/lib/services/workspace";

export default async function WorkspacePage() {
  const workspacePath = await getPrimaryWorkspacePath();
  redirect(workspacePath ?? "/get-started");
}
