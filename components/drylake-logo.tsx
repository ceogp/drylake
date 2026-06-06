import Image from "next/image";

type DryLakeLogoProps = {
  alt?: string;
  className?: string;
  priority?: boolean;
  tone?: "light" | "dark";
};

export function DryLakeLogo({
  alt = "drylake",
  className = "h-10 w-auto",
  priority = false,
  tone = "light",
}: DryLakeLogoProps) {
  return (
    <Image
      alt={alt}
      className={className}
      height={180}
      priority={priority}
      src={tone === "dark" ? "/brand/drylake-logo-dark.png" : "/brand/drylake-logo-light.png"}
      width={520}
    />
  );
}
