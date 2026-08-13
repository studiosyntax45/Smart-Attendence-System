
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Droplets,
  GraduationCap,
  Home,
  IdCard,
  Phone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StudentDetails {
  pesu_id: string;
  branch: string;
  section: string;
  dob: string;
  blood_group: string;
  sslc_pct: number;
  puc_pct: number;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  aadhaar_last4: string;
}


const show = (v: string | null | undefined) => (v && v.trim() ? v : "Ã¢â‚¬â€");

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2.5 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-right text-sm font-medium", mono && "font-mono text-xs")}>
        {value}
      </dd>
    </div>
  );
}


function PctRow({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="space-y-1.5 py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xs font-medium tabular-nums">
          {pct !== null ? `${Number(pct)}%` : "Ã¢â‚¬â€"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export default function StudentProfile() {
  const { profile } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-profile", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const res = await api.get<{ details: Record<string, unknown> | null }>(
        `/student-details/${profile!.id}`
      );
      const raw = res.details;
      const details: StudentDetails | null = raw
        ? {
            pesu_id: String(raw.pesuId ?? raw.pesu_id ?? ""),
            branch: String(raw.branch ?? ""),
            section: String(raw.section ?? ""),
            dob: String(raw.dob ?? ""),
            blood_group: String(raw.bloodGroup ?? raw.blood_group ?? ""),
            sslc_pct: Number(raw.sslcPct ?? raw.sslc_pct ?? 0),
            puc_pct: Number(raw.pucPct ?? raw.puc_pct ?? 0),
            father_name: String(raw.fatherName ?? raw.father_name ?? ""),
            father_phone: String(raw.fatherPhone ?? raw.father_phone ?? ""),
            mother_name: String(raw.motherName ?? raw.mother_name ?? ""),
            mother_phone: String(raw.motherPhone ?? raw.mother_phone ?? ""),
            address: String(raw.address ?? ""),
            city: String(raw.city ?? ""),
            state: String(raw.state ?? ""),
            pincode: String(raw.pincode ?? ""),
            aadhaar_last4: String(raw.aadhaarLast4 ?? raw.aadhaar_last4 ?? ""),
          }
        : null;
      return { details };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError)
    return (
      <SectionError
        error={new Error("Could not load your profile.")}
        reset={() => refetch()}
      />
    );

  const d = data?.details ?? null;
  const dob = d?.dob
    ? new Date(d.dob).toLocaleDateString([], {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="My Profile" />
      
      <Card className="overflow-hidden">
        <div
          className="h-20 bg-gradient-to-r from-[hsl(var(--pes-navy))] via-[hsl(var(--pes-navy-bright))] to-[hsl(var(--pes-orange))]"
          aria-hidden="true"
        />
        <CardContent className="relative flex flex-wrap items-end gap-4 p-6 pt-0">
          <div
            className="-mt-10 flex size-20 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-primary font-display text-2xl font-bold text-primary-foreground shadow-pop"
            aria-hidden="true"
          >
            {initials(profile.fullName)}
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <h1 className="truncate text-2xl font-bold">{profile.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{show(profile.rollNo)}</span>
              {d?.pesu_id && (
                <>
                  {" Ã‚Â· "}
                  <span className="font-mono">{d.pesu_id}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {d?.branch && (
              <Badge variant="secondary">
                <GraduationCap className="size-3" aria-hidden="true" />
                {d.branch}
              </Badge>
            )}
            {d?.section && <Badge variant="outline">Section {d.section}</Badge>}
            {d?.blood_group && (
              <Badge variant="absent">
                <Droplets className="size-3" aria-hidden="true" />
                {d.blood_group}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!d && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Your detailed profile hasn&apos;t been filled in yet Ã¢â‚¬â€ the sections
            below populate once your details are added (via seed or admin).
          </CardContent>
        </Card>
      )}

      
      <section className="grid items-start gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
              Personal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Date of birth" value={dob ?? "Ã¢â‚¬â€"} />
              <Row label="Blood group" value={show(d?.blood_group)} />
              <Row label="Branch" value={show(d?.branch)} />
              <Row label="Section" value={show(d?.section)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="size-4 text-muted-foreground" aria-hidden="true" />
              Pre-university
            </CardTitle>
            <CardDescription>Qualifying examination scores</CardDescription>
          </CardHeader>
          <CardContent>
            <PctRow label="SSLC / 10th" pct={d?.sslc_pct ?? null} />
            <PctRow label="PUC / 12th" pct={d?.puc_pct ?? null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              Family
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Father" value={show(d?.father_name)} />
              <Row label="Father's phone" value={show(d?.father_phone)} mono />
              <Row label="Mother" value={show(d?.mother_name)} />
              <Row label="Mother's phone" value={show(d?.mother_phone)} mono />
            </dl>
            {(d?.father_phone || d?.mother_phone) && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="size-3.5" aria-hidden="true" />
                Used for attendance-shortfall alerts (planned).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="size-4 text-muted-foreground" aria-hidden="true" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Street" value={show(d?.address)} />
              <Row label="City" value={show(d?.city)} />
              <Row label="State" value={show(d?.state)} />
              <Row label="PIN code" value={show(d?.pincode)} mono />
            </dl>
          </CardContent>
        </Card>
      </section>

      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="size-4 text-muted-foreground" aria-hidden="true" />
            Identity documents
          </CardTitle>
          <CardDescription>
            Only the last 4 digits of Aadhaar are ever stored Ã¢â‚¬â€ the full
            number never enters this system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <Row
              label="Aadhaar"
              value={d?.aadhaar_last4 ? `Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢-Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢-${d.aadhaar_last4}` : "Ã¢â‚¬â€"}
              mono
            />
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Masked by design; visible to you and administrators only.
          </p>
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
