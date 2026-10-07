"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Drawer } from "@/shared/components/Drawer";
import { getProjectResources } from "@/features/projects/actions";
import type { Project, ProjectResources } from "@/features/projects/models/project";

/** Loads a project's resource details (link URLs, BOM file) when a drawer opens. */
export function ResourceLoader({
  project,
  title,
  onClose,
  children,
}: {
  project: Project;
  title: string;
  onClose: () => void;
  children: (resources: ProjectResources) => ReactNode;
}) {
  const [state, setState] = useState<
    { status: "loading" } | { status: "error"; message: string } | { status: "ready"; resources: ProjectResources }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getProjectResources(project.id).then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", resources: result.resources }
          : { status: "error", message: result.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  if (state.status === "ready") return <>{children(state.resources)}</>;

  return (
    <Drawer title={title} subtitle={project.name} onClose={onClose}>
      {state.status === "loading" ? (
        <p aria-live="polite" className="text-[13px] text-muted">
          Loading…
        </p>
      ) : (
        <p role="alert" className="text-[13px] text-danger">
          {state.message}
        </p>
      )}
    </Drawer>
  );
}
