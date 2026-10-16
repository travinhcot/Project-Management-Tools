import type { DepartmentResourceRepository } from "../repository/department-resource.repository.ts";
import type { DepartmentStorageRepository } from "../repository/department-storage.repository.ts";
import type {
  DepartmentCodeName,
  DepartmentResource,
  DownloadUrl,
  LinkCreate,
  ResourceUpdate,
  UploadRequest,
} from "../model/department-resource.model.ts";

import { createHash, randomUUID } from "node:crypto";
import { HttpError } from "../../../shared/http-error.ts";
import {
  contentProblem,
  extensionOf,
  matchesSignature,
} from "../../../shared/file-signature.ts";
import { departmentResourceError } from "../common/department-resource-errors.ts";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_BYTES,
  ORPHAN_AFTER_MINUTES,
  SIGNED_URL_TTL_SECONDS,
} from "../model/department-resource.model.ts";

const NOT_FOUND = new HttpError(404, "FILE_NOT_FOUND", "File not found.");

export function createDepartmentResourceService(
  repository: DepartmentResourceRepository,
  storage: DepartmentStorageRepository,
  bucketId: string,
) {
  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw departmentResourceError(error);
    }
  }

  /** Best effort: a failed cleanup is retried by the orphan job. */
  async function quietly(work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch {
      /* the orphan cleanup job removes what is left */
    }
  }

  async function entry(
    actorId: string,
    department: DepartmentCodeName | null,
    id: string,
  ): Promise<DepartmentResource> {
    const found = (await repository.list(actorId, department)).find((resource) => resource.id === id);
    if (!found) throw new TypeError("Unexpected database response.");
    return found;
  }

  return {
    list(actorId: string, department: DepartmentCodeName | null): Promise<DepartmentResource[]> {
      return guarded(() => repository.list(actorId, department));
    },

    /** The project's department library plus which entries the project links to. */
    projectResources(
      actorId: string,
      projectId: string,
    ): Promise<{ resource_ids: string[]; resources: DepartmentResource[] }> {
      return guarded(async () => {
        // The ids call is the access check: it fails for a project the actor may not see.
        const resource_ids = await repository.projectLinkIds(actorId, projectId);
        const department = await repository.projectDepartment(projectId);
        return { resource_ids, resources: await repository.list(actorId, department) };
      });
    },

    projectLinkCounts(projectIds: readonly string[]): Promise<Record<string, number>> {
      return guarded(() => repository.projectLinkCounts(projectIds));
    },

    setProjectResources(
      actorId: string,
      projectId: string,
      resourceIds: readonly string[],
      requestId: string,
    ): Promise<{ resource_ids: string[]; resources: DepartmentResource[] }> {
      return guarded(async () => {
        await repository.setProjectLinks({ actorId, projectId, resourceIds, requestId });
        const resource_ids = await repository.projectLinkIds(actorId, projectId);
        const department = await repository.projectDepartment(projectId);
        return { resource_ids, resources: await repository.list(actorId, department) };
      });
    },

    createLink(
      actorId: string,
      department: DepartmentCodeName | null,
      link: LinkCreate,
      requestId: string,
    ): Promise<DepartmentResource> {
      return guarded(async () => {
        const id = await repository.createLink({ actorId, department, ...link, requestId });
        return entry(actorId, department, id);
      });
    },

    update(
      actorId: string,
      department: DepartmentCodeName | null,
      resourceId: string,
      changes: ResourceUpdate,
      requestId: string,
    ): Promise<DepartmentResource> {
      return guarded(async () => {
        await repository.update({ actorId, department, resourceId, changes, requestId });
        return entry(actorId, department, resourceId);
      });
    },

    remove(
      actorId: string,
      department: DepartmentCodeName | null,
      resourceId: string,
      requestId: string,
    ): Promise<void> {
      return guarded(() => repository.remove({ actorId, department, resourceId, requestId }));
    },

    /**
     * Two-phase upload: register a pending row, put the object, then activate it (and retire the
     * file it replaces) in one database transaction.
     */
    upload(request: UploadRequest): Promise<DepartmentResource> {
      return guarded(async () => {
        const extension = extensionOf(request.filename);
        const type = ALLOWED_FILE_TYPES[extension];
        if (!type) {
          throw new HttpError(415, "UNSUPPORTED_FILE_TYPE", "This file type is not accepted.");
        }
        if (request.declaredType !== type.contentType) {
          throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", `Send the file with Content-Type ${type.contentType}.`);
        }
        if (request.bytes.length === 0) throw new HttpError(400, "INVALID_INPUT", "The file is empty.");
        if (request.bytes.length > MAX_FILE_BYTES) {
          throw new HttpError(413, "FILE_TOO_LARGE", `Files can be at most ${MAX_FILE_BYTES / (1024 * 1024)} MB.`);
        }
        if (!matchesSignature(request.bytes, type)) {
          throw new HttpError(415, "UNSUPPORTED_FILE_TYPE", "The file content does not match its extension.");
        }
        const problem = contentProblem(request.bytes, extension);
        if (problem) throw new HttpError(415, "UNSUPPORTED_FILE_TYPE", problem);

        const pending = await repository.beginUpload({
          actorId: request.actorId,
          department: request.department,
          bucketId,
          objectPath: `department-resources/${randomUUID()}.${extension}`,
          filename: request.filename,
          contentType: type.contentType,
          sizeBytes: request.bytes.length,
          checksum: createHash("sha256").update(request.bytes).digest("hex"),
        });
        try {
          await storage.put(pending.bucket_id, pending.object_path, request.bytes, type.contentType);
          const id = await repository.finalizeUpload({
            actorId: request.actorId,
            department: request.department,
            fileId: pending.id,
            resourceId: request.resourceId,
            fields: request.fields,
            requestId: request.requestId,
          });
          return await entry(request.actorId, request.department, id);
        } catch (error) {
          await quietly(() => storage.remove(pending.bucket_id, [pending.object_path]));
          await quietly(() => repository.abortUpload(request.actorId, request.department, pending.id));
          throw error;
        }
      });
    },

    /** Unknown, retired and unauthorized files all look the same. */
    downloadUrl(
      actorId: string,
      department: DepartmentCodeName | null,
      resourceId: string,
    ): Promise<DownloadUrl> {
      return guarded(async () => {
        const target = await repository.fileTarget(actorId, department, resourceId);
        if (!target) throw NOT_FOUND;
        return {
          url: await storage.signedUrl(
            target.bucket_id,
            target.object_path,
            SIGNED_URL_TTL_SECONDS,
            target.original_filename,
          ),
          expires_in: SIGNED_URL_TTL_SECONDS,
          filename: target.original_filename,
        };
      });
    },

    /** Removes pending uploads that never finished. */
    cleanupOrphans(): Promise<{ removed: number }> {
      return guarded(async () => {
        const orphans = await repository.listOrphans(ORPHAN_AFTER_MINUTES);
        const byBucket = new Map<string, string[]>();
        for (const orphan of orphans) {
          const paths = byBucket.get(orphan.bucket_id) ?? [];
          paths.push(orphan.object_path);
          byBucket.set(orphan.bucket_id, paths);
        }
        for (const [bucket, paths] of byBucket) await storage.remove(bucket, paths);
        const removed =
          orphans.length > 0 ? await repository.deleteOrphans(orphans.map((orphan) => orphan.id)) : 0;
        return { removed };
      });
    },
  };
}
export type DepartmentResourceService = ReturnType<typeof createDepartmentResourceService>;
