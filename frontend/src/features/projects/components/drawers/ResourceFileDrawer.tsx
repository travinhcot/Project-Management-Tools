"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { Field } from "@/shared/components/Field";
import { ResourceLinkFields } from "@/features/projects/components/drawers/ResourceLinkFields";
import {
  FILE_EXTENSIONS,
  type FileSlotName,
  type Project,
  type ResourceSource,
  type SemesterSummary,
} from "@/features/projects/models/project";
import {
  describeExtensions,
  formatBytes,
  validateHttpsUrl,
  validateLabel,
  validateResourceFile,
} from "@/features/projects/utils/validation";

type Source = "file" | "link";

const SOURCES: { value: Source; label: string }[] = [
  { value: "file", label: "Upload file" },
  { value: "link", label: "External link" },
];

interface SlotCopy {
  /** Used mid-sentence: "Replace the BOM". */
  noun: string;
  /** Used as a label: "BOM file". */
  title: string;
  /** Only the BOM can also be an external link. */
  allowLink: boolean;
  hint: string;
  note: string;
  linkPlaceholder?: string;
}

const COPY: Record<FileSlotName, SlotCopy> = {
  SRS: {
    noun: "SRS",
    title: "SRS file",
    allowLink: false,
    hint: "PDF only, up to 10 MB.",
    note: "Every project needs an SRS. Members download it from their project page.",
  },
  BOM: {
    noun: "BOM",
    title: "BOM file",
    allowLink: true,
    hint: "Excel (.xlsx) or PDF, up to 10 MB.",
    note: "Only hardware projects need a BOM. Members download it from their project page.",
    linkPlaceholder: "https://example.com/open-bench-bom",
  },
  RESEARCH_TEMPLATE: {
    noun: "research template",
    title: "Research template",
    allowLink: false,
    hint: "Word (.docx) or PDF, up to 10 MB.",
    note: "Only research projects use a template. Members download it from their project page.",
  },
};

function describe(source: ResourceSource) {
  return source.kind === "file"
    ? `${source.filename} · ${formatBytes(source.sizeBytes)}`
    : (source.label ?? source.url);
}

export function ResourceFileDrawer({
  slot,
  project,
  current,
  semester,
  onClose,
  onSaveFile,
  onSaveLink,
  onRemove,
  busy = false,
  error,
}: {
  slot: FileSlotName;
  project: Pick<Project, "name">;
  /** The resource as it is on the backend right now. */
  current: ResourceSource | null;
  semester: SemesterSummary;
  onClose: () => void;
  onSaveFile: (file: File) => void;
  /** Only slots that accept a link (the BOM) need it. */
  onSaveLink?: (link: { url: string; label: string | null }) => void;
  onRemove: () => void;
  busy?: boolean;
  /** Backend message from the last failed save or remove. */
  error?: string;
}) {
  const copy = COPY[slot];
  // A project can still hold a link from before a slot became file-only: show it, ask for a file.
  const [source, setSource] = useState<Source>(
    copy.allowLink && current?.kind === "link" ? "link" : "file",
  );
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState(current?.kind === "link" ? current.url : "");
  const [label, setLabel] = useState(
    current?.kind === "link" ? (current.label ?? "") : "",
  );
  const [errors, setErrors] = useState<{ url?: string; label?: string }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = FILE_EXTENSIONS[slot].map((ext) => `.${ext}`).join(",");

  function pick(next: File | undefined) {
    if (!next) return;
    const problem = validateResourceFile(slot, next);
    setFileError(problem);
    setFile(problem ? null : next);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (source === "file") {
      if (!file) {
        // Keeping the uploaded file is a no-op; otherwise a file is required.
        if (current?.kind === "file") return onClose();
        setFileError(`Choose ${describeExtensions(slot)} to upload.`);
        return;
      }
      onSaveFile(file);
      return;
    }
    const next = { url: validateHttpsUrl(url), label: validateLabel(label) };
    setErrors(next);
    if (next.url || next.label) return;
    onSaveLink?.({ url: url.trim(), label: label.trim() || null });
  }

  return (
    <Drawer
      title={current ? copy.title : `Add ${copy.title.toLowerCase()}`}
      subtitle={`${project.name}  ·  ${semester.label}`}
      onClose={onClose}
    >
      {current && (
        <div className="flex flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
          <span className="text-[11px] font-semibold text-muted">
            Current {copy.noun}
          </span>
          <span className="break-all text-[13px] font-medium text-ink">
            {describe(current)}
          </span>
          <span className="text-xs text-muted">
            Saving a new {copy.noun} replaces this one.
          </span>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {copy.allowLink && (
          <Field label="Source">
            <div role="radiogroup" aria-label="Source" className="flex flex-wrap gap-2">
              {SOURCES.map((option) => {
                const selected = source === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSource(option.value)}
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
        )}

        {source === "file" ? (
          <Field label={copy.title} error={fileError} hint={copy.hint}>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center gap-2 rounded-lg border border-dashed p-5 text-center ${
                dragging
                  ? "border-primary bg-accent-soft"
                  : "border-line bg-chrome"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                aria-label={copy.title}
                onChange={(event) => pick(event.target.files?.[0])}
                className="sr-only"
              />
              {file ? (
                <p className="break-all text-[13px] font-semibold text-ink">
                  {file.name}{" "}
                  <span className="font-normal text-muted">
                    · {formatBytes(file.size)}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted">Drag a file here, or</p>
              )}
              <Button
                variant="link"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                {file ? "Choose a different file" : "Choose file"}
              </Button>
            </div>
          </Field>
        ) : (
          <ResourceLinkFields
            url={url}
            label={label}
            urlError={errors.url}
            labelError={errors.label}
            urlPlaceholder={copy.linkPlaceholder ?? "https://example.com/file"}
            onUrlChange={setUrl}
            onLabelChange={setLabel}
          />
        )}

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
            {busy ? "Saving…" : current ? `Replace ${copy.noun}` : `Save ${copy.noun}`}
          </Button>
        </div>
      </form>

      {current && (
        <section className="flex flex-col items-start gap-2 rounded-[10px] border border-danger-line bg-surface p-3">
          <h3 className="text-sm font-bold text-danger">Remove {copy.noun}</h3>
          <p className="text-xs text-muted">
            The project will show as missing its {copy.noun} until a new one is added.
          </p>
          <Button variant="danger-outline" onClick={onRemove} disabled={busy}>
            Remove {copy.noun}
          </Button>
        </section>
      )}
    </Drawer>
  );
}
