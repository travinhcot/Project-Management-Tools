"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { Field } from "@/shared/components/Field";
import { ResourceLinkFields } from "@/features/projects/components/drawers/ResourceLinkFields";
import type {
  Project,
  ProjectBom,
  SemesterSummary,
} from "@/features/projects/models/project";
import {
  formatBytes,
  validateBomFile,
  validateHttpsUrl,
  validateLabel,
} from "@/features/projects/utils/validation";

type Source = "file" | "link";

const SOURCES: { value: Source; label: string }[] = [
  { value: "file", label: "Upload file" },
  { value: "link", label: "External link" },
];

function describe(bom: ProjectBom) {
  return bom.kind === "file"
    ? `${bom.filename} · ${formatBytes(bom.sizeBytes)}`
    : (bom.label ?? bom.url);
}

export function BomFileDrawer({
  project,
  semester,
  onClose,
  onSave,
  onRemove,
}: {
  project: Project;
  semester: SemesterSummary;
  onClose: () => void;
  onSave: (bom: ProjectBom) => void;
  onRemove: () => void;
}) {
  const current = project.bom;
  const [source, setSource] = useState<Source>(current?.kind ?? "file");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState(current?.kind === "link" ? current.url : "");
  const [label, setLabel] = useState(
    current?.kind === "link" ? (current.label ?? "") : "",
  );
  const [errors, setErrors] = useState<{ url?: string; label?: string }>({});
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(next: File | undefined) {
    if (!next) return;
    const error = validateBomFile(next);
    setFileError(error);
    setFile(error ? null : next);
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
        setFileError("Choose an .xlsx or .pdf file to upload.");
        return;
      }
      onSave({ kind: "file", filename: file.name, sizeBytes: file.size });
      return;
    }
    const next = { url: validateHttpsUrl(url), label: validateLabel(label) };
    setErrors(next);
    if (next.url || next.label) return;
    onSave({ kind: "link", url: url.trim(), label: label.trim() || null });
  }

  return (
    <Drawer
      title={current ? "BOM file" : "Add BOM file"}
      subtitle={`${project.name}  ·  ${semester.label}`}
      onClose={onClose}
    >
      {current && (
        <div className="flex flex-col gap-0.5 rounded-[10px] bg-chrome p-3">
          <span className="text-[11px] font-semibold text-muted">
            Current BOM
          </span>
          <span className="break-all text-[13px] font-medium text-ink">
            {describe(current)}
          </span>
          <span className="text-xs text-muted">
            Saving a new BOM replaces this one.
          </span>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Source">
          <div role="radiogroup" aria-label="Source" className="flex gap-2">
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

        {source === "file" ? (
          <Field
            label="BOM file"
            error={fileError}
            hint="Excel (.xlsx) or PDF, up to 10 MB."
          >
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
                accept=".xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label="BOM file"
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
            urlPlaceholder="https://example.com/open-bench-bom"
            onUrlChange={setUrl}
            onLabelChange={setLabel}
          />
        )}

        <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
          Only hardware projects need a BOM. Members download it from their
          project page.
        </p>

        <div className="flex gap-2.5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{current ? "Replace BOM" : "Save BOM"}</Button>
        </div>
      </form>

      {current && (
        <section className="flex flex-col items-start gap-2 rounded-[10px] border border-danger-line bg-surface p-3">
          <h3 className="text-sm font-bold text-danger">Remove BOM</h3>
          <p className="text-xs text-muted">
            The project will show as missing its BOM until a new one is added.
          </p>
          <Button variant="danger-outline" onClick={onRemove}>
            Remove BOM
          </Button>
        </section>
      )}
    </Drawer>
  );
}
