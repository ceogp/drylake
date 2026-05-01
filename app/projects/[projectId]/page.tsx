import { notFound, redirect } from "next/navigation";

import { requireProjectAccess } from "@/lib/services/access";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  const access = await requireProjectAccess(projectId).catch(() => null);

  if (!access) {
    notFound();
  }

  const latestVersion = await prisma.packageVersion.findFirst({
    where: {
      agentPackage: {
        projectId: access.project.id,
      },
    },
    orderBy: [{ createdAt: "desc" }, { versionNumber: "desc" }],
    select: {
      id: true,
    },
  });

  if (!latestVersion) {
    notFound();
  }

  redirect(`/versions/${latestVersion.id}`);
}
