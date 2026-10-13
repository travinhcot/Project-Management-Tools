"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import { Field, SelectBox, TextArea, TextInput } from "@/shared/components/Field";
import {
  ACTIVE_DEPARTMENTS,
  DEPARTMENT_LABELS,
  type DepartmentCode,
} from "@/config/departments";
import {
  addLink,
  createDownload,
  removeResource,
  updateResource,
  uploadResource,
  type ActionResult,
} from "@/features/department-resources/actions";
import {
  CATEGORY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  FILE_ACCEPT,
  TITLE_MAX_LENGTH,
  validateFile,
  type DepartmentResource,
} from "@/features/department-resources/models/department-resource";
import { formatShortDay, formatSize } from "@/features/member/utils/format";

type DrawerState =
  | { kind: "link" }
  | { kind: "file"; /** Dropped or picked on the page before the drawer opened. */ file?: File }
  | { kind: "edit"; id: string }
  | { kind: "replace"; id: string }
  | null;

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

function ResourceDrawer({
  state,
  resource,
  department,
  departmentLabel,
  onClose,
}: {
  state: Exclude<DrawerState, null>;
  resource?: DepartmentResource;
  department: DepartmentCode | null;
  departmentLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(resource?.title ?? "");
  const [category, setCategory] = useState(resource?.category ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [file, setFile] = useState<File | null>(state.kind === "file" ? (state.file ?? null) : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startSubmit] = useTransition();

  const needsFile = state.kind === "file" || state.kind === "replace";
  const needsUrl = state.kind === "link" || (state.kind === "edit" && resource?.kind === "link");
  const heading = {
    link: "Add a link",
    file: "Upload a file",
    edit: "Edit resource",
    replace: "Replace file",
  }[state.kind];

  function validate() {
    const next: Record<string, string> = {};
    if (state.kind !== "replace" || title.trim()) {
      if (!title.trim() && state.kind !== "replace") next.title = "Enter a title.";
      if ([...title.trim()].length > TITLE_MAX_LENGTH) next.title = `Use ${TITLE_MAX_LENGTH} characters or fewer.`;
    }
    if ([...category.trim()].length > CATEGORY_MAX_LENGTH) next.category = `Use ${CATEGORY_MAX_LENGTH} characters or fewer.`;
    if ([...description.trim()].length > DESCRIPTION_MAX_LENGTH) next.description = `Use ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;
    if (needsUrl) {
      try {
        const parsed = new URL(url.trim());
        if (parsed.protocol !== "https:") next.url = "The link must start with https://.";
      } catch {
        next.url = "Enter a valid link, for example https://example.com/brand-guide.";
      }
    }
    if (needsFile) {
      if (!file) next.file = "Choose a file.";
      else {
        const problem = validateFile(file);
        if (problem) next.file = problem;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    if (!validate()) return;
    startSubmit(async () => {
      let result: ActionResult;
      if (needsFile) {
        const data = new FormData();
        data.set("file", file!);
        data.set("title", title.trim());
        data.set("category", category.trim());
        data.set("description", description.trim());
        if (state.kind === "replace") data.set("resourceId", resource!.id);
        result = await uploadResource(department, data);
      } else if (state.kind === "link") {
        result = await addLink(department, {
          title: title.trim(),
          category: category.trim(),
          description: description.trim(),
          url: url.trim(),
        });
      } else {
        const changes: { title?: string; category?: string; description?: string; url?: string } = {};
        if (title.trim() !== resource!.title) changes.title = title.trim();
        if ((category.trim() || "General") !== resource!.category) changes.category = category.trim();
        if (description.trim() !== (resource!.description ?? "")) changes.description = description.trim();
        if (needsUrl && url.trim() !== resource!.url) changes.url = url.trim();
        if (Object.keys(changes).length === 0) return onClose();
        result = await updateResource(department, resource!.id, changes);
      }
      if (!result.ok) return setFormError(result.message);
      router.refresh();
      onClose();
    });
  }

  return (
    <Drawer
      title={heading}
      subtitle={resource ? `${resource.title}  ·  ${departmentLabel}` : departmentLabel}
      onClose={onClose}
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-[10px] border border-danger-line bg-danger-soft p-3 text-[13px] text-ink">
            {formError}
          </p>
        )}
        <Field
          label={state.kind === "replace" ? "Title (leave as is to keep)" : "Title"}
          htmlFor="resource-title"
          error={errors.title}
        >
          <TextInput
            id="resource-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Brand guidelines 2026"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Category (optional)"
          htmlFor="resource-category"
          hint="Items with the same category are grouped, e.g. Branding, Templates, Photos."
          error={errors.category}
        >
          <TextInput
            id="resource-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="General"
            autoComplete="off"
          />
        </Field>
        {needsUrl && (
          <Field label="Link" htmlFor="resource-url" error={errors.url}>
            <TextInput
              id="resource-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              autoComplete="off"
            />
          </Field>
        )}
        {needsFile && (
          <Field
            label="File"
            htmlFor="resource-file"
            hint="PDF, PNG, JPG, Word, Excel or PowerPoint, up to 10 MB. Files with macros are refused."
            error={errors.file}
          >
            <input
              id="resource-file"
              type="file"
              accept={FILE_ACCEPT}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-[13px] text-ink file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-ink"
            />
          </Field>
        )}
        <Field label="Description (optional)" htmlFor="resource-description" error={errors.description}>
          <TextArea
            id="resource-description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What it is and when to use it."
          />
        </Field>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : state.kind === "edit" ? "Save changes" : state.kind === "replace" ? "Replace file" : "Add"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

const ALL = "__all__";

/** "PDF", "PNG", ... for a file; "LINK" for a link. */
function typeBadge(resource: DepartmentResource): string {
  if (resource.kind === "link") return "LINK";
  const extension = resource.filename?.split(".").pop() ?? "";
  return (extension || "FILE").slice(0, 4).toUpperCase();
}

function countLabel(items: DepartmentResource[]): string {
  const files = items.filter((item) => item.kind === "file").length;
  const links = items.length - files;
  return [
    files > 0 && `${files} ${files === 1 ? "file" : "files"}`,
    links > 0 && `${links} ${links === 1 ? "link" : "links"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function DepartmentResourcesPage({
  resources,
  department,
  departmentLabel,
  switchable,
  audience,
}: {
  resources: DepartmentResource[];
  /** The department to send with requests: only the super-admin needs to name one. */
  department: DepartmentCode | null;
  departmentLabel: string;
  /** The super-admin can pick a department. */
  switchable: boolean;
  audience: "admin" | "member";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState(ALL);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [, startWork] = useTransition();
  // Members read and download; only the department head and the super-admin change the library.
  const canManage = audience === "admin";

  const categories = useMemo(() => {
    const byCategory = new Map<string, DepartmentResource[]>();
    for (const resource of resources) {
      byCategory.set(resource.category, [...(byCategory.get(resource.category) ?? []), resource]);
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [resources]);

  const activeTab = tab === ALL || categories.some(([category]) => category === tab) ? tab : ALL;
  const visible = activeTab === ALL ? categories : categories.filter(([category]) => category === activeTab);
  const selected = drawer && "id" in drawer ? resources.find((r) => r.id === drawer.id) : undefined;

  function open(resource: DepartmentResource) {
    setBusyId(resource.id);
    setError(undefined);
    startWork(async () => {
      if (resource.kind === "link" && resource.url) {
        window.open(resource.url, "_blank", "noopener,noreferrer");
      } else {
        const result = await createDownload(department, resource.id);
        if (result.ok) window.location.assign(result.url);
        else setError(result.message);
      }
      setBusyId(null);
    });
  }

  function remove(resource: DepartmentResource) {
    if (confirmingId !== resource.id) return setConfirmingId(resource.id);
    setConfirmingId(null);
    setBusyId(resource.id);
    setError(undefined);
    startWork(async () => {
      const result = await removeResource(department, resource.id);
      if (!result.ok) setError(result.message);
      else router.refresh();
      setBusyId(null);
    });
  }

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold ${
      active ? "bg-primary text-white" : "border border-line bg-surface text-ink hover:bg-chrome"
    }`;

  return (
    <div className="flex flex-col gap-[22px]">
      <p className="whitespace-pre-wrap break-words text-[13px] font-medium text-muted">
        {"Workspace  /  Project Management  /  Department resources"}
      </p>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-bold sm:text-[30px] text-ink">Department resources</h1>
          <p className="text-sm text-muted">
            Brand assets, guidelines and shared files every {departmentLabel} project builds from.
          </p>
        </div>
        {switchable && (
          <SelectBox
            label="Department"
            value={department ?? ""}
            onChange={(value) => router.replace(`${pathname}?department=${value}`)}
            options={ACTIVE_DEPARTMENTS.map((code) => ({ value: code, label: DEPARTMENT_LABELS[code] }))}
            className="h-11 w-full sm:w-[160px]"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Resource categories" className="flex flex-wrap items-center gap-2">
          <button type="button" role="tab" aria-selected={activeTab === ALL} onClick={() => setTab(ALL)} className={tabClass(activeTab === ALL)}>
            All
            <span className={`text-xs font-medium ${activeTab === ALL ? "text-cyan-soft" : "text-muted"}`}>{resources.length}</span>
          </button>
          {categories.map(([category, items]) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={activeTab === category}
              onClick={() => setTab(category)}
              className={tabClass(activeTab === category)}
            >
              {category}
              <span className={`text-xs font-medium ${activeTab === category ? "text-cyan-soft" : "text-muted"}`}>{items.length}</span>
            </button>
          ))}
        </div>
        {canManage && (
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => setDrawer({ kind: "link" })}>
              + Add link
            </Button>
            <Button
              className="h-11 flex-1 bg-gradient-to-br from-primary to-[#1a8bf2] sm:w-[180px] sm:flex-none"
              onClick={() => setDrawer({ kind: "file" })}
            >
              ⤒&nbsp;&nbsp;Upload resource
            </Button>
          </div>
        )}
      </div>

      <p className="flex items-center gap-2.5 rounded-[10px] border border-line bg-chrome px-4 py-3 text-[13px] font-medium text-muted">
        <span aria-hidden="true" className="text-sm font-bold text-accent">ⓘ</span>
        {canManage
          ? `Only the ${departmentLabel} Head can upload, edit or remove resources. Members can view and download.`
          : `You have view access. Download files and open links. Ask the ${departmentLabel} Head to add or change a resource.`}
      </p>

      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-[10px] border border-danger-line bg-danger-soft px-4 py-3 text-[13px] text-ink">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError(undefined)} className="text-lg leading-none text-muted hover:text-ink">
            ×
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-surface shadow-card p-8 text-center">
          <p className="text-[15px] font-semibold text-ink">Nothing here yet</p>
          <p className="mt-1 text-xs text-muted">
            {canManage
              ? "Upload the brand guidelines, logos and templates your team needs."
              : `The ${departmentLabel} Head has not added any resources yet.`}
          </p>
        </div>
      ) : (
        visible.map(([category, items]) => (
          <section key={category} className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-ink">{category}</h2>
              <p className="text-[13px] font-medium text-muted">{countLabel(items)}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((resource) => {
                const busy = busyId === resource.id;
                const confirming = confirmingId === resource.id;
                return (
                  <article key={resource.id} className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-card">
                    <div
                      className={`flex size-11 items-center justify-center rounded-[10px] text-[11px] font-bold text-accent ${
                        resource.kind === "link" ? "bg-cyan-soft" : "bg-accent-soft"
                      }`}
                    >
                      {typeBadge(resource)}
                    </div>
                    <h3 className="min-w-0 break-words text-sm font-semibold text-ink">{resource.title}</h3>
                    <p className="break-words text-xs font-medium text-muted">
                      {resource.kind === "file"
                        ? `${formatSize(resource.sizeBytes ?? 0)} · Updated ${formatShortDay(resource.updatedAt)}`
                        : `${hostOf(resource.url ?? "")} · Updated ${formatShortDay(resource.updatedAt)}`}
                    </p>
                    {resource.description && (
                      <p className="whitespace-pre-wrap break-words text-xs text-muted">{resource.description}</p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs font-semibold text-accent">
                      {confirming ? (
                        <>
                          <button type="button" disabled={busy} onClick={() => remove(resource)} aria-label={`Confirm deleting ${resource.title}`} className="text-danger">
                            Confirm delete
                          </button>
                          <button type="button" onClick={() => setConfirmingId(null)} className="text-muted">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" disabled={busy} onClick={() => open(resource)} className="disabled:opacity-50">
                            {busy ? "Opening…" : resource.kind === "file" ? "Download" : "Open link →"}
                          </button>
                          {canManage && (
                            <>
                              <button type="button" disabled={busy} onClick={() => setDrawer({ kind: "edit", id: resource.id })}>
                                Edit
                              </button>
                              {resource.kind === "file" && (
                                <button type="button" disabled={busy} onClick={() => setDrawer({ kind: "replace", id: resource.id })}>
                                  Replace
                                </button>
                              )}
                              <button type="button" disabled={busy} onClick={() => remove(resource)} aria-label={`Delete ${resource.title}`} className="text-danger">
                                Delete
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      {canManage && drawer && (drawer.kind === "link" || drawer.kind === "file" || selected) && (
        <ResourceDrawer
          key={`${drawer.kind}-${selected?.id ?? "new"}`}
          state={drawer}
          resource={selected}
          department={department}
          departmentLabel={departmentLabel}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
