import type { Metadata } from "next";

import { XupraProductsIndexPage } from "@/app/_components/xupra-public-pages";

export const metadata: Metadata = {
  title: {
    absolute: "Products | Xupra",
  },
  description:
    "Xupra product portfolio: DryLake for agent operations and Guard workflows, and KYA Registry for hosted agent certificates and public verification.",
};

export default function ProductsPage() {
  return <XupraProductsIndexPage />;
}
