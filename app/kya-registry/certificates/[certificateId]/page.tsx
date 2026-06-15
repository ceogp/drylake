import type { Metadata } from "next";

import KyaCertificatePage from "@/KYAregistry/routes/public/certificate-page";

export const metadata: Metadata = {
  title: {
    absolute: "Hosted KYA Certificate | Xupra",
  },
  description:
    "Xupra hosted Know Your Agent certificate page with agent-readable verification details.",
};

export default KyaCertificatePage;
