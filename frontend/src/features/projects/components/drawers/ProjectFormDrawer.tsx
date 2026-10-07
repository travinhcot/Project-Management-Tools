"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import {
  Field,
  SelectBox,
  TextArea,
  TextInput,
} from "@/shared/components/Field";
import type { ActionResult } from "@/features/projects/actions";
import {
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PROJECT_STATUSES,
  STATUS_LABELS,
  type Project,
  type ProjectInput,
  type ProjectStatus,
  type SemesterSummary,
} from "@/features/projects/models/project";
import type { ProjectType } from "@/shared/models/project";

const TYPES: { value: ProjectType; label: string }[] = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
];

const STATUS_OPTIONS = PROJECT_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

type Props = {
  semester: SemesterSummary;
  onClose: () => void;
  /** `changes` holds only the edited fields; `loadedAt` is the updated_at the form was loaded from. */
  onSubmit: (
    input: ProjectInput,
    changes: Partial<ProjectInput>,
    loadedAt: string,
  ) => Promise<ActionResult>;
} & (
  | { mode: "create" }
  | { mode: "edit"; project: Project; onArchive: () => void }
);

export function ProjectFormDrawer(props: Props) {
  const { semester, onClose, onSubmit } = props;
  const editing = props.mode === "edit" ? props.project : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<ProjectType>(editing?.type ?? "software");
  const [status, setStatus] = useState<ProjectStatus>(editing?.status ?? "planning");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [loadedAt, setLoadedAt] = useState(editing?.updatedAt ?? "");
  const [errors, setErrors] = useState<{ name?: string; type?: string; description?: string }>({});
  const [formError, setFormError] = useState<{ code: string; message: string }>();
  const [pending, startSubmit] = useTransition();

  function validate() {
    const next: { name?: string; type?: string; description?: string } = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = "Enter a project name.";
    else if ([...trimmed].length > NAME_MAX_LENGTH)
      next.name = `Use ${NAME_MAX_LENGTH} characters or fewer.`;
    if ([...description.trim()].length > DESCRIPTION_MAX_LENGTH)
      next.description = `Use ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    if (!validate()) return;
    const input: ProjectInput = {
      name: name.trim(),
      type,
      status,
      description: description.trim(),
    };
    const changes: Partial<ProjectInput> = {};
    if (editing) {
      if (input.name !== editing.name) changes.name = input.name;
      if (input.type !== editing.type) changes.type = input.type;
      if (input.status !== editing.status) changes.status = input.status;
      if (input.description !== (editing.description ?? ""))
        changes.description = input.description;
      if (Object.keys(changes).length === 0) return onClose();
    }
    startSubmit(async () => {
      const result = await onSubmit(input, changes, loadedAt);
      if (result.ok) return onClose();
      if (result.code === "PROJECT_NAME_EXISTS") {
        setErrors({ name: "A project with this name already exists in this semester." });
      } else if (result.code === "PROJECT_HAS_BOM") {
        setErrors({ type: "Remove the BOM before switching a hardware project to software." });
      } else {
        setFormError({ code: result.code, message: result.message });
      }
    });
  }

  // The route is revalidated after every write, so `editing` already holds the latest data.
  function handleReload() {
    if (!editing) return;
    setName(editing.name);
    setType(editing.type);
    setStatus(editing.status);
    setDescription(editing.description ?? "");
    setLoadedAt(editing.updatedAt);
    setErrors({});
    setFormError(undefined);
  }

  return (
    <Drawer
      title={editing ? "Edit project" : "New project"}
      subtitle={
        editing ? `${editing.name}  ·  ${semester.label}` : semester.label
      }
      onClose={onClose}
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && (
          <p
            role="alert"
            className="rounded-[10px] border border-danger-line bg-danger-soft p-3 text-[13px] text-ink"
          >
            {formError.code === "PROJECT_STALE"
              ? "This project was changed elsewhere. Reload to see the latest version, then re-apply your edits."
              : formError.message}
          </p>
        )}
        <Field label="Project name" htmlFor="project-name" error={errors.name}>
          <TextInput
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Smart Campus API"
            aria-invalid={errors.name ? true : undefined}
            autoComplete="off"
          />
        </Field>

        <Field
          label="Type"
          error={errors.type}
          hint={
            editing?.type === "hardware"
              ? "Remove the BOM before switching a hardware project to software."
              : undefined
          }
        >
          <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-2">
            {TYPES.map((option) => {
              const selected = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setType(option.value)}
                  className={`rounded-lg border px-4 py-[9px] text-[13px] font-semibold ${
                    selected
                      ? "border-primary bg-accent-soft text-accent"
                      : "border-line bg-surface text-ink hover:bg-chrome"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Field>

        {editing && (
          <Field label="Status" htmlFor="project-status">
            <SelectBox
              id="project-status"
              label="Status"
              value={status}
              onChange={(value) => setStatus(value as ProjectStatus)}
              options={STATUS_OPTIONS}
            />
          </Field>
        )}

        {!editing && (
          <Field label="Semester" htmlFor="project-semester">
            <SelectBox
              id="project-semester"
              label="Semester"
              value={semester.id}
              onChange={() => {}}
              options={[{ value: semester.id, label: semester.label }]}
            />
          </Field>
        )}

        <Field
          label={editing ? "Description" : "Description (optional)"}
          htmlFor="project-description"
          error={errors.description}
        >
          <TextArea
            id="project-description"
            rows={editing ? 3 : 4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What the team builds and who it is for."
          />
        </Field>

        {!editing && (
          <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
            After creating, add the SRS and first meeting link. Hardware
            projects also need a BOM.
          </p>
        )}

        <div className="flex flex-wrap gap-2.5">
          {editing ? (
            <>
              <Button variant="outline" onClick={handleReload} disabled={pending}>
                Reload
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create project"}
              </Button>
            </>
          )}
        </div>
      </form>

      {props.mode === "edit" && (
        <section className="flex flex-col items-start gap-2 rounded-[10px] border border-danger-line bg-surface p-3">
          <h3 className="text-sm font-bold text-danger">Archive project</h3>
          <p className="text-xs text-muted">
            Hides the project from members and stops its emails. You can
            unarchive it later.
          </p>
          <Button variant="danger-outline" onClick={props.onArchive}>
            Archive project…
          </Button>
        </section>
      )}
    </Drawer>
  );
}
