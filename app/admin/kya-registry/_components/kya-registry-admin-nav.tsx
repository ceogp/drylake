"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sectionLinks = [
  { href: "/portal/kya-registry", label: "Overview" },
  { href: "/portal/kya-registry/companies", label: "Companies" },
  { href: "/portal/kya-registry/certificates", label: "Certificates" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/portal/kya-registry") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function KyaRegistryAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-stone-200 pb-4">
      {sectionLinks.map((link) => {
        const active = isActivePath(pathname, link.href);

        return (
          <Link
            className={[
              "rounded-md border px-3 py-2 text-sm font-medium transition",
              active
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-200 bg-white text-stone-800 hover:bg-stone-100",
            ].join(" ")}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
