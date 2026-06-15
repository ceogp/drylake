import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: {
    absolute: "KYA Registry | Xupra",
  },
  description:
    "KYA Registry is the Xupra product for AWS-signed Know Your Agent certificates, blockchain hash anchoring, public listings, and agent-to-agent verification.",
};

export default function ProductsKyaRegistryPage() {
  redirect("/kya-registry");
}
