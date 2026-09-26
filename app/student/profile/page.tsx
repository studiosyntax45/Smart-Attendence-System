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
import { formatDob, getStudentDetails, pctOrNull, personalDetailsMissing } from "@/lib/student-details";
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

const show = (v: string | null | undefined) => (v && v.trim() ? v : "—");

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
          {pct !== null ? `${Number(pct)}%` : "—"}
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

  const { data, isPending: isLoading, isError, refetch } = useQuery({
    queryKey: ["student-profile", profile?.id],
    enabled: !!profile,
    queryFn: () => getStudentDetails(profile!.id),
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError)
    return (
      <SectionError
        error={new Error("Could not load your profile.")}
        reset={() => refetch()}
      />
    );

  const d = data ?? null;
  const dob = formatDob(d?.dob);

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
              {d?.pesuId && d.pesuId !== profile.rollNo && (
                <>
                  {" · "}
                  <span className="font-mono">{d.pesuId}</span>
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
            {d?.bloodGroup && (
              <Badge variant="absent">
                <Droplets className="size-3" aria-hidden="true" />
                {d.bloodGroup}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {personalDetailsMissing(d) && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Your personal details haven&apos;t been added yet. Ask your faculty or the admin office to fill them in; they
            appear here as soon as they are saved.
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
              <Row label="Date of birth" value={dob ?? "—"} />
              <Row label="Blood group" value={show(d?.bloodGroup)} />
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
            <PctRow label="SSLC / 10th" pct={pctOrNull(d?.sslcPct)} />
            <PctRow label="PUC / 12th" pct={pctOrNull(d?.pucPct)} />
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
              <Row label="Father" value={show(d?.fatherName)} />
              <Row label="Father's phone" value={show(d?.fatherPhone)} mono />
              <Row label="Mother" value={show(d?.motherName)} />
              <Row label="Mother's phone" value={show(d?.motherPhone)} mono />
            </dl>
            {(d?.fatherPhone || d?.motherPhone) && (
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
            Only the last 4 digits of Aadhaar are ever stored — the full
            number never enters this system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <Row
              label="Aadhaar"
              value={d?.aadhaarLast4 ? `••••-••••-${d.aadhaarLast4}` : "—"}
              mono
            />
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Masked by design; visible only to you, your faculty and administrators.
          </p>
        </CardContent>
      </Card>
    </GsapReveal>
  );
}
