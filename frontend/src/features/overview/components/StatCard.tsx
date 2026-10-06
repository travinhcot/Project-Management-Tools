export function StatCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-line bg-surface p-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-[25px] font-bold leading-normal text-ink">{value}</p>
      <p className="text-xs text-muted">{caption}</p>
    </div>
  );
}
