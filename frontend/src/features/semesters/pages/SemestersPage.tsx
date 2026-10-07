"use client";

import { useState, useTransition } from "react";
import { Button } from "@/shared/components/Button";
import { SemesterBadge } from "@/shared/components/SemesterBadge";
import {
  createSemester,
  getSwitchImpact,
  setCurrentSemester,
  updateSemester,
  type ActionResult,
} from "@/features/semesters/actions";
import { SemesterForm } from "@/features/semesters/components/SemesterForm";
import { SemesterTable } from "@/features/semesters/components/SemesterTable";
import { SwitchImpactCard } from "@/features/semesters/components/SwitchImpactCard";
import type {
  Semester,
  SemesterInput,
  SwitchImpact,
} from "@/features/semesters/models/semester";
import {
  shortName,
  sortSemesters,
  type SemesterFormErrors,
} from "@/features/semesters/utils/semesters";

type FormState = { kind: "create"; key: number } | { kind: "edit"; id: string };
type Switching = { id: string; impact: SwitchImpact | null; error?: string };
type ServerErrors = SemesterFormErrors & { form?: string };

/** SEMESTER_EXISTS belongs under the Term field; everything else is a form-level message. */
function toFormErrors(result: Extract<ActionResult, { ok: false }>): ServerErrors {
  return result.code === "SEMESTER_EXISTS" ? { term: result.message } : { form: result.message };
}

// The list comes from the server (props); every action revalidates the route, so the page
// re-renders with fresh data instead of keeping its own copy.
export function SemestersPage({
  semesters,
  today,
}: {
  semesters: Semester[];
  today: string;
}) {
  const [form, setForm] = useState<FormState>({ kind: "create", key: 0 });
  const [focusForm, setFocusForm] = useState(false);
  const [serverErrors, setServerErrors] = useState<ServerErrors>();
  const [switching, setSwitching] = useState<Switching | null>(null);
  const [banner, setBanner] = useState<string>();
  const [saving, startSave] = useTransition();
  const [switchBusy, startSwitch] = useTransition();

  const current = semesters.find((semester) => semester.isCurrent);
  const sorted = sortSemesters(semesters);
  const editing = form.kind === "edit" ? semesters.find((s) => s.id === form.id) : undefined;
  const target = semesters.find((semester) => semester.id === switching?.id);
  const defaultYear = Number(today.slice(0, 4)) + 1;

  function resetForm() {
    setServerErrors(undefined);
    setForm((previous) => ({ kind: "create", key: (previous.kind === "create" ? previous.key : 0) + 1 }));
  }

  function save(input: SemesterInput) {
    setServerErrors(undefined);
    setBanner(undefined);
    startSave(async () => {
      const result = editing
        ? await updateSemester(editing.id, input)
        : await createSemester(input);
      if (!result.ok) return setServerErrors(toFormErrors(result));
      setFocusForm(false);
      resetForm();
    });
  }

  function reviewSwitch(semester: Semester) {
    setBanner(undefined);
    setSwitching({ id: semester.id, impact: null });
    startSwitch(async () => {
      const result = await getSwitchImpact(semester.id);
      setSwitching((previous) =>
        previous?.id !== semester.id
          ? previous
          : result.ok
            ? { id: semester.id, impact: result.impact }
            : { id: semester.id, impact: null, error: result.message },
      );
    });
  }

  function confirmSwitch(id: string) {
    startSwitch(async () => {
      const result = await setCurrentSemester(id);
      if (result.ok) return setSwitching(null);
      if (result.code === "SEMESTER_ALREADY_CURRENT") {
        // The list on screen was stale; the revalidated data already shows the truth.
        setBanner(result.message);
        return setSwitching(null);
      }
      setSwitching((previous) => (previous ? { ...previous, error: result.message } : previous));
    });
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Semesters"}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-[30px] text-ink">Semesters</h1>
          <p className="text-sm text-muted">
            Create terms, set dates and choose which semester is current.
          </p>
        </div>
        {current ? (
          <SemesterBadge name={shortName(current)} active />
        ) : (
          <span className="text-xs font-medium text-muted">No current semester</span>
        )}
      </div>

      {banner && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-[10px] border border-warn-line bg-warn-soft px-4 py-3 text-[13px] text-ink"
        >
          <span>{banner}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setBanner(undefined)}
            className="text-lg leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink" aria-live="polite">
          {semesters.length} {semesters.length === 1 ? "semester" : "semesters"}
        </p>
        <Button
          className="whitespace-pre"
          onClick={() => {
            setFocusForm(true);
            resetForm();
          }}
        >
          {"＋  New semester"}
        </Button>
      </div>

      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <SemesterTable
          semesters={sorted}
          today={today}
          highlightId={switching?.id ?? null}
          onEdit={(semester) => {
            setFocusForm(true);
            setServerErrors(undefined);
            setForm({ kind: "edit", id: semester.id });
          }}
          onSetCurrent={reviewSwitch}
        />

        <div className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
          <SemesterForm
            key={form.kind === "edit" ? form.id : `create-${form.key}`}
            semester={editing}
            existing={semesters}
            defaultYear={defaultYear}
            autoFocus={focusForm}
            pending={saving}
            serverErrors={serverErrors}
            onCancel={() => {
              setFocusForm(false);
              resetForm();
            }}
            onSubmit={save}
          />
          {switching && target && (
            <SwitchImpactCard
              target={target}
              current={current}
              impact={switching.impact}
              pending={switchBusy && switching.impact !== null}
              error={switching.error}
              onCancel={() => setSwitching(null)}
              onConfirm={() => confirmSwitch(target.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
