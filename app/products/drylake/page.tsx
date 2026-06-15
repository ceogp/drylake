import type { Metadata } from "next";

import { DryLakeProductPage } from "@/app/_components/xupra-public-pages";

export const metadata: Metadata = {
  title: {
    absolute: "DryLake | Xupra",
  },
  description:
    "DryLake is Agent Control and security in one workflow: planning, local Guard scans, and approved deeper review.",
};

export default function ProductsDryLakePage() {
  return <DryLakeProductPage />;
}
