import type { EmailRepository } from "../repository/email.repository.ts";
import type {
  DeliveryOutcome,
  EmailProvider,
  ProcessSummary,
  MeetingLinkGateway,
  SendJob,
  SendResult,
} from "../model/email.model.ts";

import { emailError } from "../common/email-errors.ts";
import { buildContext } from "../template/context.ts";
import { renderEmail } from "../template/render-email.ts";

const CAMPAIGN_BATCH = 10;
const LEASE_SECONDS = 300;
const SEND_TIMEOUT_MS = 8_000;
const ERROR_SUMMARY_LENGTH = 200;

interface ProcessorOptions {
  readonly appUrl: string;
  readonly batchSize: number;
  readonly sendTimeoutMs?: number;
  readonly meetingLinks?: MeetingLinkGateway;
}

function sanitize(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, ERROR_SUMMARY_LENGTH);
}

const timedOut: SendResult = {
  ok: false,
  outcome: "UNKNOWN",
  code: "TIMEOUT",
  message: "The provider did not answer in time.",
};

export function createProcessorService(
  repository: EmailRepository,
  provider: EmailProvider,
  options: ProcessorOptions,
) {
  const timeoutMs = options.sendTimeoutMs ?? SEND_TIMEOUT_MS;

  /** A timeout or a thrown error means the mail may or may not have left: UNKNOWN, never auto-resent. */
  async function send(job: SendJob): Promise<SendResult> {
    const meetingUrl =
      job.kind === "KICKOFF" && job.project_id
        ? await options.meetingLinks?.meetingUrl(job.project_id).catch(() => null)
        : null;
    const rendered = renderEmail(
      job.kind,
      buildContext(
        {
          subject: job.subject,
          recipientName: job.recipient_name,
          projectId: job.project_id,
          projectName: job.project_name,
          semesterName: job.semester_name,
          demoUrl: job.demo_registration_url,
          meetingUrl,
        },
        options.appUrl,
      ),
    );
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        provider.send({
          to: job.recipient_email,
          ...rendered,
          idempotencyKey: job.delivery_id,
        }),
        new Promise<SendResult>((resolve) => {
          timer = setTimeout(() => resolve(timedOut), timeoutMs);
        }),
      ]);
    } catch (error) {
      return {
        ok: false,
        outcome: "UNKNOWN",
        code: "PROVIDER_ERROR",
        message: error instanceof Error ? error.message : "Provider failed.",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /** One scheduler tick: start due campaigns, send a batch, settle finished campaigns. */
    async processDue(): Promise<ProcessSummary> {
      try {
        const started = await repository.claimDueCampaigns(CAMPAIGN_BATCH);
        const jobs = await repository.claimDueDeliveries(
          options.batchSize,
          LEASE_SECONDS,
        );
        let sent = 0;
        let failed = 0;
        let unknown = 0;
        for (const job of jobs) {
          const result = await send(job);
          const outcome: DeliveryOutcome = result.ok ? "SENT" : result.outcome;
          if (outcome === "SENT") sent += 1;
          else if (outcome === "UNKNOWN") unknown += 1;
          else failed += 1;
          await repository.recordResult({
            deliveryId: job.delivery_id,
            outcome,
            messageId: result.ok ? result.messageId : undefined,
            errorCode: result.ok ? undefined : result.code,
            errorSummary: result.ok ? undefined : sanitize(result.message),
          });
        }
        return {
          campaigns_started: started.length,
          deliveries_attempted: jobs.length,
          sent,
          failed,
          unknown,
          campaigns_finalized: await repository.finalizeDueCampaigns(),
        };
      } catch (error) {
        throw emailError(error);
      }
    },
  };
}

export type ProcessorService = ReturnType<typeof createProcessorService>;
