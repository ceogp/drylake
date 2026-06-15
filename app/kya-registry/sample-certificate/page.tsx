import type { Metadata } from "next";

import KyaSampleCertificatePage from "@/KYAregistry/routes/public/sample-certificate-page";

export const metadata: Metadata = {
  title: {
    absolute: "Sample KYA Certificate | Xupra",
  },
  description:
    "Illustrative Xupra KYA certificate showing hosted verification fields, trust signing, and MCP handshake references.",
};

export default KyaSampleCertificatePage;
