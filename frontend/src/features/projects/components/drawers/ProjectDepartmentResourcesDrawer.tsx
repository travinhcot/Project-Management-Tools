"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/shared/components/Button";
import { Drawer } from "@/shared/components/Drawer";
import {
  getProjectDepartmentResources,
  setProjectDepartmentResources,
} from "@/features/department-resources/actions";
import type { DepartmentResource } from "@/features/department-resources/models/department-resource";
import type { Project, SemesterSummary } from "@/features/projects/models/project";

/** Pick which entries of the department's resource library this project links to. */
export function ProjectDepartmentResourcesDrawer({
  project,
  semester,
  onClose,
}: {
  project: Pick<Project, "id" | "name">;
  semester: SemesterSummary;
  onClose: () => void;
}) {
  const [resources, setResources] = useState<DepartmentResource[]>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getProjectDepartmentResources(project.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) return setError(result.message);
      setResources(result.resources);
      setSelected(new Set(result.linkedIds));
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, DepartmentResource[]>();
    for (const resource of resources ?? []) {
      byCategory.set(resource.category, [...(byCategory.get(resource.category) ?? []), resource]);
    }
    return [...byCategory.entries()];
  }, [resources]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function save() {
    setError(undefined);
    startSaving(async () => {
      const result = await setProjectDepartmentResources(project.id, [...selected]);
      if (result.ok) onClose();
      else setError(result.message);
    });
  }

  return (
    <Drawer
      title="Add project resources"
      subtitle={`${project.name}  ·  ${semester.label}`}
      onClose={onClose}
    >
      <p className="rounded-[10px] bg-accent-soft p-3 text-xs text-info-text">
        Choose entries from your department resources. Members of this project see the ones you
        tick on their project page.
      </p>

      {!resources && !error && (
        <p aria-live="polite" className="text-[13px] text-muted">
          Loading…
        </p>
      )}

      {resources && resources.length === 0 && (
        <p className="text-[13px] text-muted">
          The department library is empty. Add links and files there first.
        </p>
      )}

      {groups.map(([category, items]) => (
        <fieldset key={category} className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-muted">{category}</legend>
          {items.map((resource) => (
            <label
              key={resource.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-chrome p-2.5 text-[13px]"
            >
              <input
                type="checkbox"
                checked={selected.has(resource.id)}
                onChange={() => toggle(resource.id)}
                disabled={saving}
                className="mt-0.5 size-4 accent-[var(--color-primary)]"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="break-words font-semibold text-ink">{resource.title}</span>
                <span className="break-words text-xs text-muted">
                  {resource.kind === "file" ? (resource.filename ?? "File") : (resource.url ?? "Link")}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ))}

      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving || !resources}>
          {saving ? "Saving…" : "Save resources"}
        </Button>
        <Link href="/department-resources" className="text-[13px] font-semibold text-accent">
          Manage library →
        </Link>
      </div>
    </Drawer>
  );
}
