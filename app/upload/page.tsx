import { redirect } from "next/navigation";

import { UploadWorkflowPage } from "@/components/upload-workflow-page";
import { getPrimaryWorkspaceVersionId } from "@/lib/services/workspace";

export default async function UploadPage() {
  const versionId = await getPrimaryWorkspaceVersionId();

  if (!versionId) {
    redirect("/");
  }

  return <UploadWorkflowPage versionId={versionId} />;
}
