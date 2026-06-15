import type { Metadata } from "next";

import KyaRegistryListPage from "@/KYAregistry/routes/public/registry-list-page";

export const metadata: Metadata = {
  title: {
    absolute: "Public KYA Registry | Xupra",
  },
  description:
    "Public Xupra KYA Registry listings for reviewed companies, MCP servers, agents, and hosted certificates.",
};

export default function Page(props: PageProps<"/kya-registry/registry">) {
  return <KyaRegistryListPage {...props} />;
}
