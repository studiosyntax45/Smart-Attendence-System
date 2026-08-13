
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function AppNav({
  items,
  onItemClick,
}: {
  items: NavItem[];
  onItemClick?: () => void;
}) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Main Navigation" className="flex flex-col gap-1.5 px-3 py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== `/${item.href.split("/")[1]}/dashboard` &&
            pathname.startsWith(`${item.href}`));

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onItemClick}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                  active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
            )}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

