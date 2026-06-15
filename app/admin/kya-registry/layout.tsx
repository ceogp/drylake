import type { ReactNode } from "react";

import { KyaRegistryAdminShell } from "@/app/admin/kya-registry/_components/kya-registry-admin-ui";

export default function Layout({ children }: { children: ReactNode }) {
  return <KyaRegistryAdminShell>{children}</KyaRegistryAdminShell>;
}
