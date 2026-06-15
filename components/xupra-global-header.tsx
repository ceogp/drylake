"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { HeaderAuthControls } from "@/components/header-auth-controls";

type XupraGlobalHeaderProps = {
  marketingOrigin: string;
  appOrigin: string;
  authConfigured: boolean;
  signedIn: boolean;
  accountLabel?: string;
  logoutHref: string;
  organizationSwitcher?: ReactNode;
  portalLabel?: string;
};

type NavItem = {
  label: string;
  href: string;
  description?: string;
};

type ProductMenu = {
  title: string;
  href: string;
  tagline: string;
  signal: string;
  accent: "drylake" | "kya";
  links: NavItem[];
};

function hrefFor(origin: string, pathname: string) {
  return `${origin}${pathname}`;
}

function isCurrentPath(pathname: string, href: string) {
  try {
    const url = href.startsWith("/") ? new URL(href, "https://local.invalid") : new URL(href);
    return pathname === url.pathname || pathname.startsWith(`${url.pathname}/`);
  } catch {
    return false;
  }
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="14"
      viewBox="0 0 14 14"
      width="14"
    >
      <path d="M3.5 5.25 7 8.75l3.5-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function PlainLink({
  children,
  className,
  href,
  onClick,
}: {
  children: ReactNode;
  className: string;
  href: string;
  onClick?: () => void;
}) {
  if (href.startsWith("/")) {
    return (
      <Link className={className} href={href} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <a className={className} href={href} onClick={onClick}>
      {children}
    </a>
  );
}

function ProductMenuLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isCurrentPath(pathname, item.href);

  return (
    <PlainLink
      className={[
        "group/link grid gap-1 rounded-md border px-3 py-3 text-left transition",
        active
          ? "border-[#d7e2df] bg-[#e8f1ed] text-[#101414]"
          : "border-transparent text-zinc-200 hover:border-zinc-700 hover:bg-[#202626] hover:text-white",
      ].join(" ")}
      href={item.href}
    >
      <span className="text-sm font-semibold leading-none">{item.label}</span>
      {item.description ? (
        <span className={active ? "text-xs leading-5 text-[#35413d]" : "text-xs leading-5 text-zinc-500 group-hover/link:text-zinc-300"}>
          {item.description}
        </span>
      ) : null}
    </PlainLink>
  );
}

function ProductDropdown({ product }: { product: ProductMenu }) {
  const accentClassName =
    product.accent === "drylake"
      ? "border-emerald-300/35 bg-[linear-gradient(135deg,rgba(42,68,61,0.92),rgba(20,26,26,0.96))]"
      : "border-orange-300/35 bg-[linear-gradient(135deg,rgba(72,53,36,0.92),rgba(20,26,26,0.96))]";
  const lineClassName = product.accent === "drylake" ? "bg-emerald-300/75" : "bg-orange-300/80";

  return (
    <div className="w-[38rem] overflow-hidden rounded-lg border border-zinc-700/80 bg-[#141919]/95 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
      <div className="grid grid-cols-[0.9fr_1.1fr]">
        <PlainLink
          className={`relative isolate grid min-h-72 content-between overflow-hidden border-r p-5 text-white ${accentClassName}`}
          href={product.href}
        >
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          <span className="absolute -right-10 top-10 h-36 w-36 rotate-45 border border-white/10" />
          <span className="absolute bottom-8 right-8 h-24 w-24 border border-white/10" />
          <span className="relative grid gap-4">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58">
              Xupra product
            </span>
            <span className="font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">
              {product.title}
            </span>
            <span className="max-w-56 text-sm leading-6 text-zinc-200">{product.tagline}</span>
          </span>
          <span className="relative grid gap-3">
            <span className={`h-1 w-16 ${lineClassName}`} />
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-300">
              {product.signal}
            </span>
          </span>
        </PlainLink>
        <div className="grid content-start gap-2 p-3">
          {product.links.map((item) => (
            <ProductMenuLink item={item} key={item.href} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileProductSection({ product }: { product: ProductMenu }) {
  return (
    <details className="border-t border-zinc-800 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-zinc-100 [&::-webkit-details-marker]:hidden">
        <span>{product.title}</span>
        <ChevronIcon className="text-zinc-500" />
      </summary>
      <div className="mt-3 grid gap-2">
        <PlainLink
          className="rounded-md border border-zinc-700 bg-[#1a2020] px-3 py-3 text-sm font-semibold text-zinc-100"
          href={product.href}
        >
          Product overview
        </PlainLink>
        {product.links.map((item) => (
          <PlainLink
            className="rounded-md px-3 py-2 text-sm text-zinc-300 transition hover:bg-[#202626] hover:text-white"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </PlainLink>
        ))}
      </div>
    </details>
  );
}

function buildProducts(appOrigin: string, marketingOrigin: string): ProductMenu[] {
  return [
    {
      title: "DryLake",
      href: hrefFor(marketingOrigin, "/products/drylake"),
      tagline: "Agent Control, local security scans, Guard reports, and team posture.",
      signal: "Plan. Scan. Control.",
      accent: "drylake",
      links: [
        {
          label: "Overview",
          href: hrefFor(marketingOrigin, "/products/drylake"),
          description: "The DryLake product page.",
        },
        {
          label: "Agent Control",
          href: hrefFor(appOrigin, "/"),
          description: "Plan phases and run agent handoffs.",
        },
        {
          label: "Guard",
          href: hrefFor(appOrigin, "/guard"),
          description: "Free local scan and AWS-backed review.",
        },
        {
          label: "Install Extension",
          href: hrefFor(appOrigin, "/extensions/install"),
          description: "VS Code and Cursor install path.",
        },
        {
          label: "Pricing",
          href: hrefFor(appOrigin, "/pricing"),
          description: "DryLake billing is separate from KYA.",
        },
      ],
    },
    {
      title: "KYA Registry",
      href: hrefFor(marketingOrigin, "/kya-registry"),
      tagline: "Hosted Know Your Agent certificates and online verification.",
      signal: "Certify. Publish. Verify.",
      accent: "kya",
      links: [
        {
          label: "Overview",
          href: hrefFor(marketingOrigin, "/kya-registry"),
          description: "What KYA Registry offers.",
        },
        {
          label: "Standards",
          href: hrefFor(marketingOrigin, "/kya-registry/standards"),
          description: "Review criteria and certificate rules.",
        },
        {
          label: "Sample Certificate",
          href: hrefFor(marketingOrigin, "/kya-registry/sample-certificate"),
          description: "Hosted verification credential model.",
        },
        {
          label: "Contact",
          href: "mailto:registry@xupracorp.com",
          description: "Start a registry conversation.",
        },
      ],
    },
  ];
}

export function XupraGlobalHeader({
  accountLabel,
  appOrigin,
  authConfigured,
  logoutHref,
  marketingOrigin,
  organizationSwitcher,
  portalLabel,
  signedIn,
}: XupraGlobalHeaderProps) {
  const products = buildProducts(appOrigin, marketingOrigin);
  const [openProduct, setOpenProduct] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openMenu(title: string) {
    clearCloseTimer();
    setOpenProduct(title);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenProduct(null), 220);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenProduct(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenProduct(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      clearCloseTimer();
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[#2b3332] bg-[#121616]/92 shadow-[0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:flex-nowrap md:gap-6 md:px-8">
        <div className="flex min-w-0 items-center gap-5 lg:gap-7">
          <a className="inline-flex items-center gap-3 text-zinc-50" href={marketingOrigin}>
            <span className="grid h-8 w-8 place-items-center border border-zinc-600 bg-[#1a2020] font-[family-name:var(--font-heading)] text-lg font-semibold">
              X
            </span>
            <span className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">
              Xupra
            </span>
          </a>

          <nav className="relative hidden md:block" ref={navRef}>
            <div className="flex items-center gap-1 rounded-md border border-zinc-800 bg-[#171d1d] p-1 shadow-inner shadow-black/20">
              {products.map((product) => {
                const open = openProduct === product.title;

                return (
                  <div
                    className="relative"
                    key={product.title}
                    onMouseEnter={() => openMenu(product.title)}
                    onMouseLeave={scheduleClose}
                  >
                    <button
                      aria-controls={`xupra-product-menu-${product.accent}`}
                      aria-expanded={open}
                      className={[
                        "group inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-semibold outline-none transition",
                        open
                          ? "bg-[#252d2c] text-white"
                          : "text-zinc-300 hover:bg-[#252d2c] hover:text-white focus:bg-[#252d2c] focus:text-white",
                      ].join(" ")}
                      onClick={() => setOpenProduct((value) => (value === product.title ? null : product.title))}
                      onFocus={() => openMenu(product.title)}
                      type="button"
                    >
                      {product.title}
                      <ChevronIcon className={["text-zinc-500 transition", open ? "rotate-180 text-zinc-100" : ""].join(" ")} />
                    </button>
                    {open ? (
                      <div
                        className="xupra-nav-content absolute left-0 top-full z-50 pt-3"
                        data-state="open"
                        id={`xupra-product-menu-${product.accent}`}
                        onMouseEnter={clearCloseTimer}
                        onMouseLeave={scheduleClose}
                      >
                        <ProductDropdown product={product} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </nav>
        </div>

        <details className="order-3 w-full md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md border border-zinc-800 bg-[#171d1d] px-4 py-3 text-sm font-semibold text-zinc-100 [&::-webkit-details-marker]:hidden">
            <span>Products</span>
            <ChevronIcon className="text-zinc-500" />
          </summary>
          <div className="mt-3 border border-zinc-800 bg-[#141919] px-4 py-1 shadow-2xl">
            {products.map((product) => (
              <MobileProductSection key={product.title} product={product} />
            ))}
            <div className="border-t border-zinc-800 py-3">
              {portalLabel ? (
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  {portalLabel}
                </span>
              ) : (
                <HeaderAuthControls
                  accountLabel={accountLabel}
                  configured={authConfigured}
                  logoutHref={logoutHref}
                  organizationSwitcher={organizationSwitcher}
                  signedIn={signedIn}
                />
              )}
            </div>
          </div>
        </details>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          {portalLabel ? (
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {portalLabel}
            </span>
          ) : (
            <HeaderAuthControls
              accountLabel={accountLabel}
              configured={authConfigured}
              logoutHref={logoutHref}
              organizationSwitcher={organizationSwitcher}
              signedIn={signedIn}
            />
          )}
        </div>
      </div>
    </header>
  );
}
