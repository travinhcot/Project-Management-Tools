type ResourceTileProps = {
  label: string;
} & (
  | { state: "set"; value: string; onOpen: () => void }
  | { state: "missing"; value: string; onOpen: () => void }
  | { state: "na"; value: string; note: string }
);

const base = "flex h-[142px] flex-col items-start gap-3 rounded-lg p-3 text-left";

export function ResourceTile(props: ResourceTileProps) {
  const heading = (
    <span className="text-[11px] font-semibold text-muted">{props.label}</span>
  );

  if (props.state === "na") {
    return (
      <div className={`${base} bg-chrome`}>
        {heading}
        <span className="text-xs font-medium text-ink">{props.value}</span>
        <span className="text-[11px] font-medium text-muted">{props.note}</span>
      </div>
    );
  }

  const missing = props.state === "missing";
  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={`${base} ${missing ? "bg-accent-soft" : "bg-chrome"} hover:ring-1 hover:ring-primary/40`}
    >
      {heading}
      <span
        className={`w-full truncate text-xs ${missing ? "font-semibold text-accent" : "font-medium text-ink"}`}
      >
        {props.value}
      </span>
      <span className="whitespace-pre text-[11px] font-medium text-accent">
        {missing ? "Add details  →" : "View / edit  →"}
      </span>
    </button>
  );
}
