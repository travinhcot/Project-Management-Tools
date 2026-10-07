"use server";

import { revalidatePath } from "next/cache";
import { backendFetch } from "@/shared/api/backend";
import { ApiError } from "@/shared/api/errors";
import type { Delivery } from "@/features/meeting-emails/models/meeting-email";
import {
  fetchDeliveries,
  fetchPreview,
  type EmailPreviewData,
} from "@/features/meeting-emails/service/meeting-emails.service";

export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

const PATH = "/meeting-emails";

/** Turns a backend ApiError into a result the UI can show; anything else (incl. redirects) rethrows. */
async function run<T extends object>(work: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await work()) };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
}

/** Runs a write and refreshes the page either way, so a stale view never lingers. */
async function write(work: () => Promise<unknown>): Promise<ActionResult> {
  const result = await run(async () => {
    await work();
    return {};
  });
  revalidatePath(PATH);
  revalidatePath("/projects");
  return result;
}

export async function sendKickoffNow(projectId: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/projects/${projectId}/kickoff-campaign`, {
      method: "POST",
      body: { send_now: true },
    }),
  );
}

/** `date` is yyyy-mm-dd; the backend sends it at 09:00 GMT+7. */
export async function scheduleKickoff(projectId: string, date: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/projects/${projectId}/kickoff-campaign`, {
      method: "POST",
      body: { scheduled_at: date },
    }),
  );
}

export async function rescheduleCampaign(campaignId: string, date: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/campaigns/${campaignId}`, {
      method: "PATCH",
      body: { scheduled_at: date },
    }),
  );
}

export async function sendCampaignNow(campaignId: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/campaigns/${campaignId}/send-now`, { method: "POST" }),
  );
}

export async function cancelCampaign(campaignId: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/campaigns/${campaignId}/cancel`, { method: "POST" }),
  );
}

export async function retryFailedDeliveries(campaignId: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/campaigns/${campaignId}/retry-failures`, { method: "POST" }),
  );
}

/** A deliberate resend: creates a new campaign for everyone. */
export async function resendCampaign(campaignId: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/campaigns/${campaignId}/resend`, { method: "POST" }),
  );
}

/** Settles a delivery whose outcome is UNKNOWN: confirm it was sent, or send it again. */
export async function resolveDelivery(
  campaignId: string,
  deliveryId: string,
  action: "MARK_SENT" | "RETRY",
): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/campaigns/${campaignId}/deliveries/${deliveryId}/resolve`, {
      method: "POST",
      body: { action },
    }),
  );
}

export async function getDeliveries(
  campaignId: string,
): Promise<ActionResult<{ deliveries: Delivery[] }>> {
  return run(async () => ({ deliveries: await fetchDeliveries(campaignId) }));
}

export async function getPreview(
  campaignId: string,
): Promise<ActionResult<{ preview: EmailPreviewData }>> {
  return run(async () => ({ preview: await fetchPreview(campaignId) }));
}

export async function saveMeetingLink(
  projectId: string,
  link: { url: string; label: string | null },
): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/projects/${projectId}/resources/FIRST_MEETING`, {
      method: "PUT",
      body: { url: link.url, label: link.label },
    }),
  );
}

export async function removeMeetingLink(projectId: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/projects/${projectId}/resources/FIRST_MEETING`, {
      method: "DELETE",
    }),
  );
}
