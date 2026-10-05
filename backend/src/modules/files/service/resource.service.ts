import type { ResourceRepository } from "../repository/resource.repository.ts";
import type {
  ProjectType,
  Resource,
  ResourceSlot,
  ResourceSummary,
} from "../model/resource.model.ts";
import type { LinkRequest } from "../dto/resource.dto.ts";

import { HttpError } from "../../../shared/http-error.ts";
import { resourceError } from "../common/resource-errors.ts";
import { requiredSlots } from "../model/resource.model.ts";

function summaryOf(
  type: ProjectType,
  present: ReadonlySet<ResourceSlot>,
): ResourceSummary {
  const required = requiredSlots(type);
  const have = required.filter((slot) => present.has(slot));
  const missing = required.filter((slot) => !present.has(slot));
  return { present: have, missing, complete: missing.length === 0 };
}

export function createResourceService(repository: ResourceRepository) {
  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw resourceError(error);
    }
  }

  return {
    list(
      projectId: string,
    ): Promise<{ resources: Resource[]; summary: ResourceSummary }> {
      return guarded(async () => {
        const project = await repository.findProject(projectId);
        if (!project)
          throw new HttpError(404, "PROJECT_NOT_FOUND", "Project not found.");
        const resources = await repository.list(projectId);
        return {
          resources,
          summary: summaryOf(
            project.type,
            new Set(resources.map((resource) => resource.slot)),
          ),
        };
      });
    },

    setLink(
      actorId: string,
      projectId: string,
      slot: ResourceSlot,
      request: LinkRequest,
      requestId: string,
    ): Promise<Resource> {
      return guarded(async () => {
        await repository.setLink({
          actorId,
          projectId,
          slot,
          url: request.url,
          label: request.label,
          requestId,
        });
        const resource = (await repository.list(projectId)).find(
          (candidate) => candidate.slot === slot,
        );
        if (!resource)
          throw new HttpError(
            500,
            "RESOURCE_VIEW_INCOMPLETE",
            "The resource was saved, but it could not be loaded.",
          );
        return resource;
      });
    },

    clear(
      actorId: string,
      projectId: string,
      slot: ResourceSlot,
      requestId: string,
    ): Promise<void> {
      return guarded(() =>
        repository.clear({ actorId, projectId, slot, requestId }),
      );
    },

    /** Port used by the projects module: one query for a page of projects. */
    async summarize(
      projects: readonly { id: string; type: ProjectType }[],
    ): Promise<ReadonlyMap<string, ResourceSummary>> {
      if (projects.length === 0) return new Map();
      const rows = await guarded(() =>
        repository.presentSlots(projects.map((project) => project.id)),
      );
      const bySlot = new Map<string, Set<ResourceSlot>>();
      for (const row of rows) {
        const slots = bySlot.get(row.project_id) ?? new Set<ResourceSlot>();
        slots.add(row.slot);
        bySlot.set(row.project_id, slots);
      }
      return new Map(
        projects.map((project) => [
          project.id,
          summaryOf(project.type, bySlot.get(project.id) ?? new Set()),
        ]),
      );
    },
  };
}
export type ResourceService = ReturnType<typeof createResourceService>;
