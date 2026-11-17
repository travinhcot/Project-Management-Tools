"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { Field, SelectBox, TextInput } from "@/shared/components/Field";
import { addMember } from "@/features/members/actions";
import type { MemberInput } from "@/features/members/models/member";
import type { SemesterSummary } from "@/features/projects/models/project";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEPARTMENTS = [
  { value: "", label: "Choose department" },
  { value: "TECH", label: "Tech" },
  { value: "MARCOM", label: "Marcom" },
  { value: "HR", label: "HR" },
] as const;

export function AddMemberDrawer({
  semester,
  canChooseDepartment,
  onClose,
  onAdded,
}: {
  semester: SemesterSummary;
  canChooseDepartment: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const id = useId();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [major, setMajor] = useState("");
  const [department, setDepartment] = useState("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    department?: string;
  }>({});
  const [serverError, setServerError] = useState<string>();
  const [warning, setWarning] = useState<string>();
  const [pending, startSave] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = {
      fullName: fullName.trim() ? undefined : "Enter the member’s full name.",
      email: EMAIL_PATTERN.test(email.trim()) ? undefined : "Enter a valid email address.",
      department:
        canChooseDepartment && !department ? "Choose the member’s department." : undefined,
    };
    setErrors(next);
    setServerError(undefined);
    if (next.fullName || next.email || next.department) return;
    startSave(async () => {
      const result = await addMember(semester.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        major: major.trim(),
        department: (department || undefined) as MemberInput["department"],
      });
      if (result.ok && result.warning) setWarning(result.warning);
      else if (result.ok) onAdded();
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
        {canChooseDepartment && (
          <Field label="Department" htmlFor={`${id}-department`} error={errors.department}>
            <SelectBox
              id={`${id}-department`}
              label="Department"
              value={department}
              onChange={setDepartment}
              options={DEPARTMENTS}
            />
          </Field>
        )}
        <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
          An account is created for this email, so you can set their role in User &amp; Access.
        </p>
        {warning && (
          <p role="status" className="text-xs font-medium text-danger">
            {warning}
          </p>
        )}
        {serverError && (
          <p role="alert" className="text-xs font-medium text-danger">
            {serverError}
          </p>
        )}
        {warning ? (
          <Button onClick={onAdded}>Done</Button>
        ) : (
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add member"}
          </Button>
        </div>
        )}
      </form>
    </Drawer>
  );
}
