const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const pad = (value: number) => String(value).padStart(2, "0");

/** "12 Oct 2026 · 09:00". UTC and fixed month names keep server and client output identical. */
export function formatKickoff(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** "29 Sep 2026 · 10:15 GMT+7" (Asia/Ho_Chi_Minh has no DST, so a fixed offset is exact). */
export function formatGmt7(iso: string): string {
  const date = new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000);
  return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} GMT+7`;
}

/** Lower-case, diacritic-free text for search ("Nguyễn" matches "nguyen"). */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase();
}
