import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { BranchSelect } from "@/components/branch-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BLOOD_GROUPS,
  dobInputValue,
  getStudentDetails,
  saveStudentDetails,
  type StudentDetails,
} from "@/lib/student-details";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type TextField = Exclude<keyof StudentDetails, "year" | "sslcPct" | "pucPct">;
type FormState = Record<TextField | "year" | "sslcPct" | "pucPct", string>;

function toForm(d: StudentDetails | null): FormState {
  const s = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    pesuId: s(d?.pesuId),
    branch: s(d?.branch),
    section: s(d?.section),
    year: s(d?.year),
    parentEmail: s(d?.parentEmail),
    dob: dobInputValue(d?.dob),
    bloodGroup: s(d?.bloodGroup),
    sslcPct: s(d?.sslcPct),
    pucPct: s(d?.pucPct),
    fatherName: s(d?.fatherName),
    fatherPhone: s(d?.fatherPhone),
    motherName: s(d?.motherName),
    motherPhone: s(d?.motherPhone),
    address: s(d?.address),
    city: s(d?.city),
    state: s(d?.state),
    pincode: s(d?.pincode),
    aadhaarLast4: s(d?.aadhaarLast4),
  };
}

function toPayload(f: FormState): Partial<StudentDetails> {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const { year, sslcPct, pucPct, ...text } = f;
  return { ...text, year: num(year), sslcPct: num(sslcPct), pucPct: num(pucPct) };
}

function Field({ id, label, children, wide }: { id: string; label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** Loads one student's details and edits them. Rendered inside the Students page dialog. */
export function StudentDetailsForm({ studentId, onSaved }: { studentId: string; onSaved: (message: string) => void }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["student-details", studentId],
    queryFn: () => getStudentDetails(studentId),
  });

  if (isPending) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading details…
      </p>
    );
  }
  if (isError) {
    return (
      <div className="space-y-3 py-6 text-sm">
        <p>Could not load this student&apos;s details.</p>
        <Button variant="outline" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }
  // Keyed so reopening another student starts from that student's saved values.
  return <Editor key={studentId} studentId={studentId} initial={toForm(data)} onSaved={onSaved} />;
}

function Editor({ studentId, initial, onSaved }: { studentId: string; initial: FormState; onSaved: (message: string) => void }) {
  const [form, setForm] = useState<FormState>(initial);
  const save = useMutation({
    mutationFn: () => saveStudentDetails(studentId, toPayload(form)),
    onSuccess: () => onSaved("Details saved."),
  });

  const input = (key: keyof FormState, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Input
      id={`sd-${key}`}
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      className="h-10"
      {...props}
    />
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-6"
    >
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Academic</legend>
        <Field id="sd-pesuId" label="PESU ID">{input("pesuId")}</Field>
        <Field id="sd-branch" label="Branch">
          <BranchSelect id="sd-branch" value={form.branch} onChange={(branch) => setForm({ ...form, branch })} />
        </Field>
        <Field id="sd-section" label="Section">{input("section", { maxLength: 10 })}</Field>
        <Field id="sd-year" label="Year">
          <select id="sd-year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={selectClass}>
            <option value="">Not set</option>
            {[1, 2, 3, 4].map((y) => (
              <option key={y} value={y}>Year {y}</option>
            ))}
          </select>
        </Field>
        <Field id="sd-sslcPct" label="SSLC / 10th %">{input("sslcPct", { type: "number", min: 0, max: 100, step: "0.01" })}</Field>
        <Field id="sd-pucPct" label="PUC / 12th %">{input("pucPct", { type: "number", min: 0, max: 100, step: "0.01" })}</Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Personal</legend>
        <Field id="sd-dob" label="Date of birth">{input("dob", { type: "date" })}</Field>
        <Field id="sd-bloodGroup" label="Blood group">
          <select id="sd-bloodGroup" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} className={selectClass}>
            <option value="">Not set</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field id="sd-aadhaarLast4" label="Aadhaar (last 4 digits only)">
          {input("aadhaarLast4", { inputMode: "numeric", maxLength: 4, pattern: "\\d{4}", title: "4 digits" })}
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Family</legend>
        <Field id="sd-fatherName" label="Father's name">{input("fatherName")}</Field>
        <Field id="sd-fatherPhone" label="Father's phone">{input("fatherPhone", { type: "tel" })}</Field>
        <Field id="sd-motherName" label="Mother's name">{input("motherName")}</Field>
        <Field id="sd-motherPhone" label="Mother's phone">{input("motherPhone", { type: "tel" })}</Field>
        <Field id="sd-parentEmail" label="Parent email" wide>{input("parentEmail", { type: "email" })}</Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Address</legend>
        <Field id="sd-address" label="Street" wide>{input("address")}</Field>
        <Field id="sd-city" label="City">{input("city")}</Field>
        <Field id="sd-state" label="State">{input("state")}</Field>
        <Field id="sd-pincode" label="PIN code">{input("pincode", { inputMode: "numeric", maxLength: 6 })}</Field>
      </fieldset>

      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {save.error instanceof Error ? save.error.message : "Could not save."}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Save details
        </Button>
      </div>
    </form>
  );
}
