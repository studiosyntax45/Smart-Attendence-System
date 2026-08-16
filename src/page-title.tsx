
export function PageTitle({ title }: { title?: string }) {
  return <title>{title ? `${title} · PES Smart Attendance` : "PES Smart Attendance"}</title>;
}
