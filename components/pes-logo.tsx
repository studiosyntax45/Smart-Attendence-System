import { cn } from "@/lib/utils";
const LOGO_LIGHT = "/pes-university-logo.png";
const LOGO_DARK = "/pes-university-logo-dark.png";


export function PesLogo({
  className,
  priority: _priority = false,
  variant = "auto",
}: {
  className?: string;
  priority?: boolean;
  variant?: "auto" | "light" | "dark";
}) {
  const alt = "PES University";

  if (variant !== "auto") {
    return (
      <img
        src={variant === "dark" ? LOGO_DARK : LOGO_LIGHT}
        alt={alt}
        className={cn("w-auto", className)}
      />
    );
  }

  return (
    <span className={cn("inline-flex", className)}>
      <img src={LOGO_LIGHT} alt={alt} className="block h-full w-auto dark:hidden" />
      <img
        src={LOGO_DARK}
        alt=""
        aria-hidden="true"
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
