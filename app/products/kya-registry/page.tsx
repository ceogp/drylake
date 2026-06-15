import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: {
    absolute: "KYA Registry | Xupra",
  },
  description:
    "KYA Registry is the Xupra product for hosted Know Your Agent certificates, public registry listings, and agent-to-agent verification.",
};

export default function ProductsKyaRegistryPage() {
  redirect("/kya-registry");
}
