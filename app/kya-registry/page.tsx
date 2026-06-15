import type { Metadata } from "next";

import KyaRegistryLandingPage from "@/KYAregistry/routes/public/registry-landing-page";

export const metadata: Metadata = {
  title: {
    absolute: "KYA Registry | Xupra",
  },
  description:
    "Xupra KYA Registry provides hosted Know Your Agent certificates for MCP servers and agents used in agent-to-agent transactions.",
};

export default KyaRegistryLandingPage;
