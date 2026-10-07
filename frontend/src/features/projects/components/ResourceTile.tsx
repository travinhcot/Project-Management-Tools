type ResourceTileProps = {
  label: string;
} & (
  | { state: "set"; value: string; onOpen: () => void }
  | { state: "missing"; value: string; onOpen: () => void }
  /** Nothing yet, and nothing required: shown quietly, not as a warning. */
  | { state: "empty"; value: string; onOpen: () => void }
  | { state: "na"; value: string; note: string }
);

const base = "flex min-h-[96px] flex-col items-start gap-3 sm:min-h-[142px] rounded-lg p-3 text-left";

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
  const empty = props.state === "empty";
  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={`${base} ${missing ? "bg-accent-soft" : "bg-chrome"} hover:ring-1 hover:ring-primary/40`}
    >
      {heading}
      <span
        className={`w-full truncate text-xs ${missing ? "font-semibold text-accent" : empty ? "font-medium text-muted" : "font-medium text-ink"}`}
      >
        {props.value}
      </span>
      <span className="whitespace-pre-wrap text-[11px] font-medium text-accent">
        {missing || empty ? "Add details  →" : "View / edit  →"}
      </span>
    </button>
  );
}
