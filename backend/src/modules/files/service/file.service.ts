import type { ResourceRepository } from "../repository/resource.repository.ts";
import type { FileStorageRepository } from "../repository/file-storage.repository.ts";
import type {
  DownloadUrl,
  FileTarget,
  ResourceFile,
  UploadRequest,
} from "../model/resource.model.ts";

import { createHash, randomUUID } from "node:crypto";
import { HttpError } from "../../../shared/http-error.ts";
import { resourceError } from "../common/resource-errors.ts";
import {
  contentProblem,
  extensionOf,
  fileTypeFor,
  matchesSignature,
} from "../common/file-signature.ts";
import {
  MAX_FILE_BYTES,
  ORPHAN_AFTER_MINUTES,
  SIGNED_URL_TTL_SECONDS,
} from "../model/resource.model.ts";

const NOT_FOUND = new HttpError(404, "FILE_NOT_FOUND", "File not found.");

export function createFileService(
  repository: ResourceRepository,
  storage: FileStorageRepository,
  bucketId: string,
) {
  async function guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw resourceError(error);
    }
  }

  async function sign(target: FileTarget): Promise<DownloadUrl> {
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
  }

  /** Best effort: a failed cleanup is retried by the orphan job. */
  async function quietly(work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch {
      /* the orphan cleanup job removes what is left */
    }
  }

  return {
    /**
     * Two-phase upload: register a pending row, put the object, then activate it
     * (retiring the previous file) in one database transaction.
     */
    upload(request: UploadRequest): Promise<ResourceFile> {
      return guarded(async () => {
        const type = fileTypeFor(request.slot, request.filename);
        if (!type) {
          throw new HttpError(
            415,
            "UNSUPPORTED_FILE_TYPE",
            "This file type is not accepted for this slot.",
          );
        }
        if (request.declaredType !== type.contentType) {
          throw new HttpError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            `Send the file with Content-Type ${type.contentType}.`,
          );
        }
        if (request.bytes.length === 0)
          throw new HttpError(400, "INVALID_INPUT", "The file is empty.");
        if (request.bytes.length > MAX_FILE_BYTES) {
          throw new HttpError(
            413,
            "FILE_TOO_LARGE",
            `Files can be at most ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
          );
        }
        if (!matchesSignature(request.bytes, type)) {
          throw new HttpError(
            415,
            "UNSUPPORTED_FILE_TYPE",
            "The file content does not match its extension.",
          );
        }
        const problem = contentProblem(
          request.bytes,
          extensionOf(request.filename),
        );
        if (problem) throw new HttpError(415, "UNSUPPORTED_FILE_TYPE", problem);

        const objectPath = `projects/${request.projectId}/${request.slot.toLowerCase()}/${randomUUID()}.${extensionOf(request.filename)}`;
        const pending = await repository.beginUpload({
          actorId: request.actorId,
          projectId: request.projectId,
          slot: request.slot,
          bucketId,
          objectPath,
          filename: request.filename,
          contentType: type.contentType,
          sizeBytes: request.bytes.length,
          checksum: createHash("sha256").update(request.bytes).digest("hex"),
        });

        try {
          await storage.put(
            pending.bucket_id,
            pending.object_path,
            request.bytes,
            type.contentType,
          );
          return await repository.finalizeUpload({
            actorId: request.actorId,
            fileId: pending.id,
            requestId: request.requestId,
          });
        } catch (error) {
          await quietly(() =>
            storage.remove(pending.bucket_id, [pending.object_path]),
          );
          await quietly(() =>
            repository.abortUpload(request.actorId, pending.id),
          );
          throw error;
        }
      });
    },

    adminDownload(
      actorId: string,
      projectId: string,
      fileId: string,
    ): Promise<DownloadUrl> {
      return guarded(async () => {
        const target = await repository.adminTarget(actorId, projectId, fileId);
        if (!target) throw NOT_FOUND;
        return sign(target);
      });
    },

    /** Unknown, retired and unauthorized files all look the same (D-09). */
    memberDownload(
      actorId: string,
      projectId: string,
      fileId: string,
    ): Promise<DownloadUrl> {
      return guarded(async () => {
        const target = await repository.memberTarget(
          actorId,
          projectId,
          fileId,
        );
        if (!target) throw NOT_FOUND;
        return sign(target);
      });
    },

    /** Removes pending uploads that never finished (FR-FILE-01 Medium). */
    cleanupOrphans(): Promise<{ removed: number }> {
      return guarded(async () => {
        const orphans = await repository.listOrphans(ORPHAN_AFTER_MINUTES);
        const byBucket = new Map<string, string[]>();
        for (const orphan of orphans) {
          const paths = byBucket.get(orphan.bucket_id) ?? [];
          paths.push(orphan.object_path);
          byBucket.set(orphan.bucket_id, paths);
        }
        for (const [bucket, paths] of byBucket)
          await storage.remove(bucket, paths);
        const removed =
          orphans.length > 0
            ? await repository.deleteOrphans(orphans.map((orphan) => orphan.id))
            : 0;
        return { removed };
      });
    },
  };
}
export type FileService = ReturnType<typeof createFileService>;
