"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { ResourceLinkFields } from "@/features/projects/components/drawers/ResourceLinkFields";
import type {
  LinkSlotName,
  ResourceSource,
  SemesterSummary,
} from "@/features/projects/models/project";
import {
  validateHttpsUrl,
  validateLabel,
} from "@/features/projects/utils/validation";

type LinkOnlySlot = Exclude<LinkSlotName, "BOM">;

interface LinkCopy {
  title: string;
  addTitle: string;
  placeholder: string;
  note: string;
  removeTitle: string;
  removeNote: string;
}

const COPY: Record<LinkOnlySlot, LinkCopy> = {
  FIRST_MEETING: {
    title: "First meeting link",
    addTitle: "Add meeting link",
    placeholder: "https://meet.example.edu/room",
    note: "This is the link members see for the first meeting. It is also used in the kick-off email.",
    removeTitle: "Remove link",
    removeNote: "Members will no longer see a first meeting link for this project.",
  },
  GITHUB_REPO: {
    title: "GitHub repository",
    addTitle: "Add GitHub repository",
    placeholder: "https://github.com/your-org/your-repo",
    note: "Set this after the kick-start date. Members open it from their project page.",
    removeTitle: "Remove repository link",
    removeNote: "Members will no longer see a GitHub repository for this project.",
  },
  DEMO_GUIDE: {
    title: "Demo video guide",
    addTitle: "Add demo video guide",
    placeholder: "https://example.com/demo-video-guide",
    note: "Set this after the kick-start date. Members open it from their project page.",
    removeTitle: "Remove guide link",
    removeNote: "Members will no longer see a demo video guide for this project.",
  },
};

export function ResourceLinkDrawer({
  slot,
  project,
  current,
  semester,
  onClose,
  onSave,
  onRemove,
  busy = false,
  error,
}: {
  slot: LinkOnlySlot;
  project: { name: string };
  /** The link as it is on the backend right now. */
  current: ResourceSource | null;
  semester: SemesterSummary;
  onClose: () => void;
  onSave: (link: { url: string; label: string | null }) => void;
  onRemove: () => void;
  /** A save or remove is in flight. */
  busy?: boolean;
  /** Backend message from the last failed save or remove. */
  error?: string;
}) {
  const copy = COPY[slot];
  const saved = current?.kind === "link" ? current : null;
  const [url, setUrl] = useState(saved?.url ?? "");
  const [label, setLabel] = useState(saved?.label ?? "");
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
      title={saved ? copy.title : copy.addTitle}
      subtitle={`${project.name}  ·  ${semester.label}`}
      onClose={onClose}
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ResourceLinkFields
          url={url}
          label={label}
          urlError={errors.url}
          labelError={errors.label}
          urlPlaceholder={copy.placeholder}
          onUrlChange={setUrl}
          onLabelChange={setLabel}
        />
        <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
          {copy.note}
        </p>
        {error && (
          <p role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {saved ? "Save link" : "Add link"}
          </Button>
        </div>
      </form>

      {saved && (
        <section className="flex flex-col items-start gap-2 rounded-[10px] border border-danger-line bg-surface p-3">
          <h3 className="text-sm font-bold text-danger">{copy.removeTitle}</h3>
          <p className="text-xs text-muted">{copy.removeNote}</p>
          <Button variant="danger-outline" onClick={onRemove} disabled={busy}>
            {copy.removeTitle}
          </Button>
        </section>
      )}
    </Drawer>
  );
}
