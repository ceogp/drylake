import { notFound, redirect } from "next/navigation";

import { requirePackageAccess } from "@/lib/services/access";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{
    packageId: string;
  }>;
};

export default async function PackagePage({ params }: PageProps) {
  const { packageId } = await params;
  const access = await requirePackageAccess(packageId).catch(() => null);

  if (!access) {
    notFound();
  }

  const latestVersion = await prisma.packageVersion.findFirst({
    where: {
      agentPackageId: access.agentPackage.id,
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
