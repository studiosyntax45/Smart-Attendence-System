
import { useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

interface KpiCardProps {
  label: string;
  
  value: string;
  sub?: string;
  
  icon: ReactNode;
  tone?: "neutral" | "present" | "late" | "absent";
  
  countTo?: number;
  
  suffix?: string;
  href?: string;
}

const TONE_CLASS = {
  neutral: "text-primary bg-primary/10",
  present: "text-status-present bg-status-present/10",
  late: "text-status-late bg-status-late/10",
  absent: "text-status-absent bg-status-absent/10",
} as const;


export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
  countTo,
  suffix = "",
  href,
}: KpiCardProps) {
  const numberRef = useRef<HTMLParagraphElement>(null);

  useGSAP(() => {
    const el = numberRef.current;
    if (
      el === null ||
      countTo === undefined ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const counter = { v: 0 };
    gsap.to(counter, {
      v: countTo,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(counter.v)}${suffix}`;
      },
    });
  }, [countTo, suffix]);

  const card = (
    <Card className="group h-full transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-pop">
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110 [&_svg]:size-5",
            TONE_CLASS[tone]
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase leading-snug tracking-wide text-muted-foreground">
            {label}
          </p>
          
          <p
            ref={numberRef}
            aria-label={value}
            className="font-display text-2xl font-semibold leading-tight tabular-nums"
          >
            {value}
          </p>
          {sub && <p className="line-clamp-2 text-xs text-muted-foreground" title={sub}>{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link to={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  ) : (
    card
  );
}
