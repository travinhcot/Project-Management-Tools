"use server";

import { ApiError } from "@/shared/api/errors";
import type { GithubActivity, GithubAudience } from "@/features/github/models/github";
import { fetchGithubActivity } from "@/features/github/service/github.service";

export type GithubResult =
  | { ok: true; activity: GithubActivity }
  | { ok: false; message: string };

export async function loadGithubActivity(
  audience: GithubAudience,
  projectId: string,
  refresh = false,
): Promise<GithubResult> {
  try {
    return { ok: true, activity: await fetchGithubActivity(audience, projectId, refresh) };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}
