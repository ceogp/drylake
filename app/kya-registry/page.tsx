import type { Metadata } from "next";

import KyaRegistryLandingPage from "@/KYAregistry/routes/public/registry-landing-page";

export const metadata: Metadata = {
  title: {
    absolute: "KYA Registry | Xupra",
  },
  description:
    "Xupra KYA Registry provides AWS-signed Know Your Agent certificates, blockchain hash anchoring, and online verification for MCP servers and agents.",
};

export default KyaRegistryLandingPage;
