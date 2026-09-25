import { useState } from "react";
import { Input } from "@/components/ui/input";
import { OTHER_BRANCH, PES_BRANCHES, isStandardBranch } from "@/lib/branches";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-10 w-full cursor-pointer rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BranchSelect({
  id,
  value,
  onChange,
  allLabel,
  required,
  className,
}: {
  id: string;
  value: string;
  onChange: (branch: string) => void;
  allLabel?: string;
  required?: boolean;
  className?: string;
}) {
  const [other, setOther] = useState(value !== "" && !isStandardBranch(value));
  const selected = other ? OTHER_BRANCH : value;

  return (
    <div className={cn("space-y-2", className)}>
      <select
        id={id}
        value={selected}
        required={required}
        suppressHydrationWarning
        onChange={(e) => {
          const v = e.target.value;
          setOther(v === OTHER_BRANCH);
          onChange(v === OTHER_BRANCH ? "" : v);
        }}
        className={selectClass}
      >
        {allLabel !== undefined ? (
          <option value="">{allLabel}</option>
        ) : (
          <option value="" disabled>
            Choose a branch…
          </option>
        )}
        {PES_BRANCHES.map((b) => (
          <option key={b.code} value={b.code}>
            {b.code} — {b.name}
          </option>
        ))}
        <option value={OTHER_BRANCH}>Other…</option>
      </select>
      {other && (
        <Input
          aria-label="Branch name"
          placeholder="Type the branch, e.g. MCA"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={60}
          required={required}
          autoFocus
        />
      )}
    </div>
  );
}
