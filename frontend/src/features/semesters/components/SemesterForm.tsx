"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Field, TextInput } from "@/shared/components/Field";
import {
  SEMESTER_TERMS,
  type Semester,
  type SemesterInput,
  type SemesterTerm,
} from "@/features/semesters/models/semester";
import {
  semesterName,
  validateSemester,
  type SemesterFormErrors,
} from "@/features/semesters/utils/semesters";

/** Create (no `semester`) or edit form. Remount with a new `key` to reset it. */
export function SemesterForm({
  semester,
  existing,
  defaultYear,
  autoFocus,
  pending,
  serverErrors,
  onCancel,
  onSubmit,
}: {
  semester?: Semester;
  existing: Semester[];
  /** Suggested year for a new semester. */
  defaultYear: number;
  autoFocus?: boolean;
  /** A save is in flight. */
  pending?: boolean;
  /** Errors returned by the backend; `form` is a message not tied to one field. */
  serverErrors?: SemesterFormErrors & { form?: string };
  onCancel: () => void;
  onSubmit: (input: SemesterInput) => void;
}) {
  const id = useId();
  const [term, setTerm] = useState<SemesterTerm>(semester?.term ?? "A");
  const [year, setYear] = useState(String(semester?.year ?? defaultYear));
  const [startsOn, setStartsOn] = useState(semester?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(semester?.endsOn ?? "");
  const [demoUrl, setDemoUrl] = useState(semester?.demoRegistrationUrl ?? "");
  const [localErrors, setErrors] = useState<SemesterFormErrors>({});
  const errors = { ...serverErrors, ...localErrors };

  const yearNumber = Number(year);
  const preview = Number.isInteger(yearNumber) && year.trim() ? semesterName(term, yearNumber) : null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const input: SemesterInput = {
      term,
      year: year.trim() ? yearNumber : Number.NaN,
      startsOn: startsOn || null,
      endsOn: endsOn || null,
      demoRegistrationUrl: demoUrl.trim() || null,
    };
    const next = validateSemester(input, existing, semester?.id);
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit(input);
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-3.5 rounded-2xl bg-surface shadow-card p-[18px]"
    >
      <h2 id={`${id}-title`} className="text-[18px] font-bold text-ink">
        {semester ? `Edit ${semester.name}` : "New semester"}
      </h2>

      <div className="flex gap-3">
        <Field label="Term" error={errors.term}>
          <div role="radiogroup" aria-label="Term" className="flex gap-1.5">
            {SEMESTER_TERMS.map((option, index) => {
              const selected = term === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  autoFocus={autoFocus && index === 0}
                  onClick={() => setTerm(option)}
                  className={`rounded-lg border px-4 py-2 text-[13px] font-semibold ${
                    selected
                      ? "border-primary bg-accent-soft text-accent"
                      : "border-line bg-surface text-ink hover:bg-chrome"
                  }`}
                >
                  Sem {option}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="min-w-0 flex-1">
          <Field label="Year" htmlFor={`${id}-year`} error={errors.year}>
            <TextInput
              id={`${id}-year`}
              inputMode="numeric"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              aria-invalid={Boolean(errors.year)}
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <Field label="Starts on" htmlFor={`${id}-start`}>
            <TextInput
              id={`${id}-start`}
              type="date"
              value={startsOn}
              onChange={(event) => setStartsOn(event.target.value)}
            />
          </Field>
        </div>
        <div className="min-w-0 flex-1">
          <Field label="Ends on" htmlFor={`${id}-end`} error={errors.endsOn}>
            <TextInput
              id={`${id}-end`}
              type="date"
              value={endsOn}
              min={startsOn || undefined}
              onChange={(event) => setEndsOn(event.target.value)}
              aria-invalid={Boolean(errors.endsOn)}
            />
          </Field>
        </div>
      </div>

      <Field
        label="Demo registration URL (optional)"
        htmlFor={`${id}-demo`}
        error={errors.demoRegistrationUrl}
      >
        <TextInput
          id={`${id}-demo`}
          type="url"
          placeholder="https://forms.example.edu/demo"
          value={demoUrl}
          onChange={(event) => setDemoUrl(event.target.value)}
          aria-invalid={Boolean(errors.demoRegistrationUrl)}
        />
      </Field>

      <p className="text-xs text-muted">
        {preview ? `Name is generated: ${preview}.` : "Name is generated from term and year."}{" "}
        Each term and year pair can exist once.
      </p>

      {serverErrors?.form && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-xs font-medium text-danger">
          {serverErrors.form}
        </p>
      )}

      <div className="flex gap-2.5">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : semester ? "Save changes" : "Create semester"}
        </Button>
      </div>
    </form>
  );
}
