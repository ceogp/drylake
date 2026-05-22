import { redirect } from "next/navigation";

import { InstallFlow } from "@/components/install-flow";
import { getPrimaryWorkspaceVersionId } from "@/lib/services/workspace";

export default async function InstallPage() {
  const versionId = await getPrimaryWorkspaceVersionId();

  if (!versionId) {
    redirect("/upload");
  }

  return (
    <main className="tape-page min-h-screen">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <div>
          <p className="tape-eyebrow">
            Skills & Agents
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-black uppercase text-stone-950">
            Install
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-700">
            Canonicalize imported files, choose a destination, and hand the write step to the Xupra extension.
          </p>
        </div>

        <InstallFlow versionId={versionId} />
      </div>
    </main>
  );
}
