import type { SupabaseClient } from "@supabase/supabase-js";

/** Private Supabase Storage access. File bytes only ever live in memory. */
export function createFileStorageRepository(client: SupabaseClient) {
  return {
    async put(
      bucketId: string,
      objectPath: string,
      bytes: Buffer,
      contentType: string,
    ): Promise<void> {
      const { error } = await client.storage
        .from(bucketId)
        .upload(objectPath, bytes, { contentType, upsert: false });
      if (error) throw error;
    },

    async remove(
      bucketId: string,
      objectPaths: readonly string[],
    ): Promise<void> {
      if (objectPaths.length === 0) return;
      const { error } = await client.storage
        .from(bucketId)
        .remove([...objectPaths]);
      if (error) throw error;
    },

    /** The signed URL forces `Content-Disposition: attachment; filename=<original>`. */
    async signedUrl(
      bucketId: string,
      objectPath: string,
      expiresInSeconds: number,
      downloadName: string,
    ): Promise<string> {
      const { data, error } = await client.storage
        .from(bucketId)
        .createSignedUrl(objectPath, expiresInSeconds, {
          download: downloadName,
        });
      if (error) throw error;
      return data.signedUrl;
    },
  };
}
export type FileStorageRepository = ReturnType<
  typeof createFileStorageRepository
>;
