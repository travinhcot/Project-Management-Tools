export function StatCard({
  label,
  value,
  caption,
  featured = false,
}: {
  label: string;
  value: string | number;
  caption: string;
  /** Gradient hero card, used for the one figure that matters most on the page. */
  featured?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl p-5 ${
        featured ? "bg-hero text-white shadow-hero" : "bg-surface shadow-card"
      }`}
    >
      <p className={`text-xs font-medium ${featured ? "opacity-85" : "text-muted"}`}>{label}</p>
      <p className={`text-[25px] font-bold leading-normal ${featured ? "" : "text-ink"}`}>{value}</p>
      <p className={`text-xs ${featured ? "opacity-85" : "text-muted"}`}>{caption}</p>
    </div>
  );
}
