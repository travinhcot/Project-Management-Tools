"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import {
  Field,
  SelectBox,
  TextArea,
  TextInput,
} from "@/shared/components/Field";
import {
  NAME_MAX_LENGTH,
  type Project,
  type ProjectInput,
  type SemesterSummary,
} from "@/features/projects/models/project";
import type { ProjectType } from "@/shared/models/project";

const TYPES: { value: ProjectType; label: string }[] = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
];

type Props = {
  semester: SemesterSummary;
  onClose: () => void;
  onSubmit: (input: ProjectInput) => void;
} & (
  | { mode: "create" }
  | { mode: "edit"; project: Project; onArchive: () => void }
);

export function ProjectFormDrawer(props: Props) {
  const { semester, onClose, onSubmit } = props;
  const editing = props.mode === "edit" ? props.project : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<ProjectType>(editing?.type ?? "software");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [errors, setErrors] = useState<{ name?: string; type?: string }>({});

  function validate() {
    const next: { name?: string; type?: string } = {};
    const trimmed = name.trim();
    if (!trimmed) next.name = "Enter a project name.";
    else if ([...trimmed].length > NAME_MAX_LENGTH)
      next.name = `Use ${NAME_MAX_LENGTH} characters or fewer.`;
    if (editing?.bom && editing.type === "hardware" && type === "software")
      next.type =
        "Remove the BOM before switching a hardware project to software.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    onSubmit({ name: name.trim(), type, description: description.trim() });
  }

  function handleReload() {
    if (!editing) return;
    setName(editing.name);
    setType(editing.type);
    setDescription(editing.description);
    setErrors({});
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
          <div role="radiogroup" aria-label="Type" className="flex gap-2">
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

        <div className="flex gap-2.5">
          {editing ? (
            <>
              <Button variant="outline" onClick={handleReload}>
                Reload
              </Button>
              <Button type="submit">Save changes</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Create project</Button>
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
