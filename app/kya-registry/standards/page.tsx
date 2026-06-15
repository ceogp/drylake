import type { Metadata } from "next";

import KyaRegistryStandardsPage from "@/KYAregistry/routes/public/registry-standards-page";

export const metadata: Metadata = {
  title: {
    absolute: "KYA Standards | Xupra",
  },
  description:
    "Published Xupra KYA Registry standards, revocation rules, evidence posture, and hosted verification criteria.",
};

export default KyaRegistryStandardsPage;
