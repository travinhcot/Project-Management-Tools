import type { PillTone } from "@/shared/components/Pill";

/** SR-6: people read times in Asia/Ho_Chi_Minh. */
export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

/** PROJECT_CREATED -> "Project created". */
export function humanize(name: string): string {
  const text = name.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function actionTone(action: string): PillTone {
  if (action.endsWith("_FAILED") || action.endsWith("_DELETED") || action.endsWith("_DEACTIVATED"))
    return "danger";
  if (action.endsWith("_CREATED") || action.endsWith("_SUCCEEDED")) return "success";
  if (action.endsWith("_UPDATED") || action.endsWith("_CHANGED")) return "accent";
  return "neutral";
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}
