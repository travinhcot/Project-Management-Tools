"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { Field, TextInput } from "@/shared/components/Field";
import { addMember } from "@/features/members/actions";
import type { SemesterSummary } from "@/features/projects/models/project";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddMemberDrawer({
  semester,
  onClose,
  onAdded,
}: {
  semester: SemesterSummary;
  onClose: () => void;
  onAdded: () => void;
}) {
  const id = useId();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [major, setMajor] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({});
  const [serverError, setServerError] = useState<string>();
  const [pending, startSave] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = {
      fullName: fullName.trim() ? undefined : "Enter the member’s full name.",
      email: EMAIL_PATTERN.test(email.trim()) ? undefined : "Enter a valid email address.",
    };
    setErrors(next);
    setServerError(undefined);
    if (next.fullName || next.email) return;
    startSave(async () => {
      const result = await addMember(semester.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        major: major.trim(),
      });
      if (result.ok) onAdded();
      else setServerError(result.message);
    });
  }

  return (
    <Drawer title="Add member" subtitle={semester.label} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Full name" htmlFor={`${id}-name`} error={errors.fullName}>
          <TextInput
            id={`${id}-name`}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Minh Anh"
            autoComplete="off"
          />
        </Field>
        <Field label="School email" htmlFor={`${id}-email`} error={errors.email}>
          <TextInput
            id={`${id}-email`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="s1234567@student.example.edu"
            autoComplete="off"
          />
        </Field>
        <Field label="Major (optional)" htmlFor={`${id}-major`}>
          <TextInput
            id={`${id}-major`}
            value={major}
            onChange={(event) => setMajor(event.target.value)}
            autoComplete="off"
          />
        </Field>
        <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
          The member can sign in with this email once they are on the roster.
        </p>
        {serverError && (
          <p role="alert" className="text-xs font-medium text-danger">
            {serverError}
          </p>
        )}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add member"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
