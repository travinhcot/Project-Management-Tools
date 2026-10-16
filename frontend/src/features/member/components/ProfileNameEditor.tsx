"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateOwnName } from "@/features/member/actions";
import { Button } from "@/shared/components/Button";
import { TextInput } from "@/shared/components/Field";

/** The "Full name" row on My profile, with an Edit button that turns it into a small form. */
export function ProfileNameEditor({ fullName }: { fullName: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fullName);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await updateOwnName(value);
      if (!result.ok) return setError(result.message);
      setEditing(false);
    });
  }

  function cancel() {
    setValue(fullName);
    setError(undefined);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 text-[13px] sm:flex-row sm:gap-3">
      <dt className="shrink-0 font-medium text-muted sm:w-[180px]">Full name</dt>
      <dd className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={save} className="flex flex-col gap-2">
            <TextInput
              aria-label="Full name"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              maxLength={200}
              autoFocus
              disabled={pending}
            />
            {error && (
              <p role="alert" className="text-xs font-medium text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending || !value.trim()}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button variant="outline" size="sm" disabled={pending} onClick={cancel}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-words font-semibold text-ink">{fullName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setValue(fullName);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          </div>
        )}
      </dd>
    </div>
  );
}
