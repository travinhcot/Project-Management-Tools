const pad = (value: number) => String(value).padStart(2, "0");

/** "20261012T090000Z" */
function icsStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
}

const escapeText = (text: string) =>
  text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** A one-hour calendar event as a data: link, so "Add to calendar" needs no server round trip. */
export function calendarHref(
  title: string,
  startIso: string,
  location?: string | null,
): string {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NCT Hub//Project Management//EN",
    "BEGIN:VEVENT",
    `UID:${icsStamp(start)}-${title.replace(/\W+/g, "-")}@nct-hub`,
    // Deterministic on purpose: the link renders on the server and again on the client.
    `DTSTAMP:${icsStamp(start)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeText(title)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function calendarFilename(title: string): string {
  return `${
    title
      .replace(/[^\w]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "event"
  }.ics`;
}
