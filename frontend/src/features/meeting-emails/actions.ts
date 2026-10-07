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

/** Saves the semester-wide links. A null value clears that link; a link left out is untouched. */
export async function saveSemesterLinks(
  semesterId: string,
  links: { kickoffMeetingUrl?: string | null; demoRegistrationUrl?: string | null },
): Promise<ActionResult> {
  const body: Record<string, string | null> = {};
  if (links.kickoffMeetingUrl !== undefined) body.kickoff_meeting_url = links.kickoffMeetingUrl;
  if (links.demoRegistrationUrl !== undefined) body.demo_registration_url = links.demoRegistrationUrl;
  const result = await write(() =>
    backendFetch(`/api/admin/semesters/${semesterId}`, { method: "PATCH", body }),
  );
  revalidatePath("/semesters");
  return result;
}

/** `date` is yyyy-mm-dd; the backend sends it at 09:00 GMT+7. */
export async function scheduleDemo(semesterId: string, date: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/semesters/${semesterId}/demo-campaign`, {
      method: "POST",
      body: { scheduled_at: date },
    }),
  );
}

export async function sendDemoNow(semesterId: string): Promise<ActionResult> {
  return write(() =>
    backendFetch(`/api/admin/semesters/${semesterId}/demo-campaign`, {
      method: "POST",
      body: { send_now: true },
    }),
  );
}

/**
 * One date for the whole semester's kick-start emails: projects with no active email get one
 * scheduled, projects with a scheduled email are moved to the new date. Anything already
 * sending or sent is left alone. Reports what happened per project.
 */
export async function scheduleKickoffForAll(
  targets: { projectId: string; name: string; campaignId: string | null }[],
  date: string,
): Promise<ActionResult<{ done: number; failed: { name: string; message: string }[] }>> {
  let done = 0;
  const failed: { name: string; message: string }[] = [];
  for (const target of targets) {
    try {
      if (target.campaignId) {
        await backendFetch(`/api/admin/campaigns/${target.campaignId}`, {
          method: "PATCH",
          body: { scheduled_at: date },
        });
      } else {
        await backendFetch(`/api/admin/projects/${target.projectId}/kickoff-campaign`, {
          method: "POST",
          body: { scheduled_at: date },
        });
      }
      done += 1;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      failed.push({ name: target.name, message: error.message });
    }
  }
  revalidatePath(PATH);
  revalidatePath("/projects");
  return { ok: true, done, failed };
}

/**
 * One date for every project's follow-up "project resources" email: projects without an active
 * email get one scheduled, scheduled ones are moved. Sending or sent ones are left alone.
 */
export async function scheduleProjectResourcesForAll(
  targets: { projectId: string; name: string; campaignId: string | null }[],
  date: string,
): Promise<ActionResult<{ done: number; failed: { name: string; message: string }[] }>> {
  let done = 0;
  const failed: { name: string; message: string }[] = [];
  for (const target of targets) {
    try {
      if (target.campaignId) {
        await backendFetch(`/api/admin/campaigns/${target.campaignId}`, {
          method: "PATCH",
          body: { scheduled_at: date },
        });
      } else {
        await backendFetch(`/api/admin/projects/${target.projectId}/resources-campaign`, {
          method: "POST",
          body: { scheduled_at: date },
        });
      }
      done += 1;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      failed.push({ name: target.name, message: error.message });
    }
  }
  revalidatePath(PATH);
  return { ok: true, done, failed };
}
