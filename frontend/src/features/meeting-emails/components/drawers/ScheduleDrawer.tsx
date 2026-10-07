"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import type { SemesterSummary } from "@/features/projects/models/project";

/** Today in GMT+7 (yyyy-mm-dd): the backend schedules date-only values at 09:00 GMT+7. */
function todayGmt7(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function ScheduleDrawer({
  projectName,
  semester,
  rescheduling,
  title,
  note,
  busy,
  error,
  onClose,
  onSchedule,
}: {
  projectName: string;
  semester: SemesterSummary;
  rescheduling: boolean;
  /** Overrides the default drawer title (e.g. for the semester-wide emails). */
  title?: string;
  /** Overrides the explanation under the date field. */
  note?: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSchedule: (date: string) => void;
}) {
  const [date, setDate] = useState("");
  const [invalid, setInvalid] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!date) return setInvalid("Choose a date.");
    if (date <= todayGmt7()) return setInvalid("Choose a date after today.");
    setInvalid(null);
    onSchedule(date);
  }

  return (
    <Drawer
      title={title ?? (rescheduling ? "Reschedule email" : "Schedule email")}
      subtitle={`${projectName}  ·  ${semester.label}`}
      onClose={onClose}
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
          Send on
          <input
            type="date"
            value={date}
            min={todayGmt7()}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          />
        </label>
        <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
          {note ??
            "The email is sent at 09:00 GMT+7 on this date to the members assigned at that time."}
        </p>
        {(invalid ?? error) && (
          <p role="alert" className="text-xs font-medium text-danger">
            {invalid ?? error}
          </p>
        )}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {rescheduling ? "Reschedule" : "Schedule"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
