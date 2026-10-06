import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export const controlClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-placeholder focus:border-primary focus:ring-2 focus:ring-primary/20";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={controlClass} {...props} />;
}

export function TextArea({
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea rows={rows} className={`${controlClass} resize-none`} {...props} />
  );
}

/** Looks like the design's "Label ▾" box; a transparent native select sits on top for a11y. */
export function SelectBox({
  label,
  value,
  onChange,
  options,
  className = "",
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
  id?: string;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <div
      className={`relative rounded-lg border border-line bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${className}`}
    >
      <span className="pointer-events-none block whitespace-pre px-3 py-[11px] text-[13px] font-medium text-ink">
        {current?.label}
        {"  ▾"}
      </span>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
