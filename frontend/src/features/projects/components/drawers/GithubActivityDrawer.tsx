"use client";

import { Drawer } from "@/shared/components/Drawer";
import { GithubActivityPanel } from "@/features/github/components/GithubActivityPanel";
import type { Project } from "@/features/projects/models/project";

/** Commit activity of the project's GitHub repository, for admins. */
export function GithubActivityDrawer({
  project,
  onClose,
}: {
  project: Pick<Project, "id" | "name">;
  onClose: () => void;
}) {
  return (
    <Drawer title="GitHub activity" subtitle={project.name} onClose={onClose}>
      <GithubActivityPanel projectId={project.id} audience="admin" framed={false} />
    </Drawer>
  );
}
