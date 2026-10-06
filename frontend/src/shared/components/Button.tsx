import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-primary text-white hover:bg-primary/90",
  outline: "border border-line bg-surface text-ink hover:bg-chrome",
  danger: "bg-danger text-white hover:bg-danger/90",
  "danger-outline":
    "border border-danger-line bg-surface text-danger hover:bg-danger-soft",
  link: "border border-link-line bg-surface text-accent hover:bg-accent-soft",
} as const;

const sizes = {
  md: "px-[18px] py-[11px] text-[13px]",
  sm: "h-[30px] px-2.5 text-xs",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg font-semibold transition-colors disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
