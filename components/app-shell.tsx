
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  CalendarCheck,
  Award,
  CheckSquare,
  ScanFace,
  User,
  BookOpen,
  GraduationCap,
  BarChart3,
  Building2,
  Layers,
  Clock,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { AppNav, type NavItem } from "@/components/app-nav";
import { PesLogo } from "@/components/pes-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/utils";

const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/student/attendance", label: "My Attendance", icon: CalendarCheck },
    { href: "/student/results", label: "Results", icon: Award },
    { href: "/student/mark-attendance", label: "Mark Attendance", icon: CheckSquare },
    { href: "/student/enroll-face", label: "Enrol Face", icon: ScanFace },
    { href: "/student/profile", label: "Profile", icon: User },
  ],
  faculty: [
    { href: "/faculty/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/faculty/attendance", label: "Attendance", icon: CalendarCheck },
    { href: "/faculty/courses", label: "Courses", icon: BookOpen },
    { href: "/faculty/marks", label: "Marks", icon: GraduationCap },
    { href: "/faculty/performance", label: "Performance", icon: BarChart3 },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/classes", label: "Classes", icon: Building2 },
    { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
    { href: "/faculty/attendance", label: "By course", icon: Layers },
    { href: "/faculty/courses", label: "Courses", icon: BookOpen },
    { href: "/faculty/marks", label: "Marks", icon: GraduationCap },
    { href: "/admin/schedule", label: "Timetable", icon: Clock },
    { href: "/admin/settings", label: "GPS Settings", icon: MapPin },
  ],
  parent: [
    { href: "/parent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ],
};

const ROLE_BADGES: Record<Role, { label: string; variant: "default" | "secondary" | "outline" }> = {
  admin: { label: "Admin Portal", variant: "default" },
  faculty: { label: "Faculty Portal", variant: "secondary" },
  student: { label: "Student Portal", variant: "outline" },
  parent: { label: "Parent Portal", variant: "secondary" },
};


export function AppShell({
  role,
  userName,
  children,
}: {
  role: Role;
  userName: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [compactNavOpen, setCompactNavOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const roleBadge = ROLE_BADGES[role] ?? { label: role, variant: "outline" };

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      
      <aside className="hidden lg:flex w-64 xl:w-72 flex-col fixed inset-y-0 left-0 z-40 bg-card border-r border-border shadow-sm">
        
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-border">
          <Link
            to={`/${role}/dashboard`}
            aria-label="PES Smart Attendance Ã¢â‚¬â€ home"
            className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PesLogo className="h-8" />
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold tracking-tight text-foreground">
                Smart Attendance
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                PES University
              </span>
            </div>
          </Link>
        </div>

        
        <div className="px-5 py-3 border-b border-border/60 bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Current Role</span>
          <Badge variant={roleBadge.variant} className="text-xs capitalize font-semibold px-2.5 py-0.5">
            {roleBadge.label}
          </Badge>
        </div>

        
        <div className="flex-1 overflow-y-auto py-3">
          <AppNav items={NAV[role]} />
        </div>

        
        <div className="shrink-0 border-t border-border p-4 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-foreground truncate" title={userName}>
                  {userName}
                </span>
                <span className="text-[11px] text-muted-foreground capitalize">
                  {role}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Sign out"
                onClick={handleSignOut}
                title="Sign out"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 h-14 bg-card/95 border-b border-border backdrop-blur flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCompactNavOpen(!compactNavOpen)}
            aria-label="Toggle navigation menu"
          >
            {compactNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <Link to={`/${role}/dashboard`} className="flex items-center gap-2">
            <PesLogo className="h-7" />
            <span className="font-display text-sm font-semibold text-foreground">
              Smart Attendance
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <Badge variant={roleBadge.variant} className="text-[10px] px-2 py-0.5">
            {role}
          </Badge>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Sign out"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

      
      {compactNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setCompactNavOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-card h-full flex flex-col shadow-xl z-50 border-r border-border">
            <div className="flex h-14 items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-2">
                <PesLogo className="h-7" />
                <span className="font-display text-sm font-bold">Menu</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCompactNavOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <AppNav items={NAV[role]} onItemClick={() => setCompactNavOpen(false)} />
            </div>
            <div className="border-t border-border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold truncate">{userName}</span>
                <Button size="sm" variant="outline" onClick={handleSignOut}>
                  <LogOut className="size-3.5 mr-1" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 xl:pl-72 min-h-dvh pt-14 lg:pt-0">
        <main id="main" className="flex-1 w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

