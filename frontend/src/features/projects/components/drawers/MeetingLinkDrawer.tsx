"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { ResourceLinkFields } from "@/features/projects/components/drawers/ResourceLinkFields";
import type {
  Project,
  SemesterSummary,
} from "@/features/projects/models/project";
import {
  validateHttpsUrl,
  validateLabel,
} from "@/features/projects/utils/validation";

export function MeetingLinkDrawer({
  project,
  semester,
  onClose,
  onSave,
  onRemove,
}: {
  project: Project;
  semester: SemesterSummary;
  onClose: () => void;
  onSave: (link: { url: string; label: string | null }) => void;
  onRemove: () => void;
}) {
  const hasLink = project.meetingUrl !== null;
  const [url, setUrl] = useState(project.meetingUrl ?? "");
  const [label, setLabel] = useState(project.meetingLabel ?? "");
  const [errors, setErrors] = useState<{ url?: string; label?: string }>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = { url: validateHttpsUrl(url), label: validateLabel(label) };
    setErrors(next);
    if (next.url || next.label) return;
    onSave({ url: url.trim(), label: label.trim() || null });
  }

  return (
    <Drawer
      title={hasLink ? "First meeting link" : "Add meeting link"}
      subtitle={`${project.name}  ·  ${semester.label}`}
      onClose={onClose}
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ResourceLinkFields
          url={url}
          label={label}
          urlError={errors.url}
          labelError={errors.label}
          urlPlaceholder="https://meet.example.edu/room"
          onUrlChange={setUrl}
          onLabelChange={setLabel}
        />
        <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
          This is the link members see for the first meeting. It is also used in
          the kick-off email.
        </p>
        <div className="flex gap-2.5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{hasLink ? "Save link" : "Add link"}</Button>
        </div>
      </form>

      {hasLink && (
        <section className="flex flex-col items-start gap-2 rounded-[10px] border border-danger-line bg-surface p-3">
          <h3 className="text-sm font-bold text-danger">Remove link</h3>
          <p className="text-xs text-muted">
            Members will no longer see a first meeting link for this project.
          </p>
          <Button variant="danger-outline" onClick={onRemove}>
            Remove link
          </Button>
        </section>
      )}
    </Drawer>
  );
}
