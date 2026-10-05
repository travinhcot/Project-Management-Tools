import type {
  DeliveryOutcome,
  EmailMessage,
  EmailProvider,
  SendResult,
} from "../model/email.model.ts";

import { Resend } from "resend";

/** The slice of the Resend SDK this adapter uses; a fake can stand in for tests. */
export interface ResendClient {
  readonly emails: {
    send(
      payload: {
        from: string;
        to: string;
        subject: string;
        html: string;
        text: string;
      },
      options: { idempotencyKey: string },
    ): Promise<{
      data: { id: string } | null;
      error: {
        name: string;
        message: string;
        statusCode: number | null;
      } | null;
    }>;
  };
}

export interface ResendProviderOptions {
  readonly apiKey: string;
  /** Sender shown to recipients, e.g. "EBMB <noreply@club-domain>". */
  readonly from: string;
  readonly client?: ResendClient;
}

type Failure = Exclude<DeliveryOutcome, "SENT">;

/** Codes where the same request may succeed later. Resend dedupes on the idempotency key, so a retry cannot double-send. */
const RETRYABLE_CODES = new Set([
  "rate_limit_exceeded",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
  "internal_server_error",
  "application_error",
]);

/** The first request with this key may still be running, so the result is unknown. */
const UNKNOWN_CODES = new Set(["concurrent_idempotent_requests"]);

function classify(name: string, statusCode: number | null): Failure {
  if (UNKNOWN_CODES.has(name)) return "UNKNOWN";
  if (RETRYABLE_CODES.has(name)) return "RETRYABLE";
  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) {
    return "RETRYABLE";
  }
  return "PERMANENT";
}

/** Sends through Resend. Never throws: every failure becomes a classified SendResult. */
export function createResendEmailProvider(
  options: ResendProviderOptions,
): EmailProvider {
  const client: ResendClient = options.client ?? new Resend(options.apiKey);
  return {
    async send(message: EmailMessage): Promise<SendResult> {
      try {
        const { data, error } = await client.emails.send(
          {
            from: options.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
          },
          { idempotencyKey: message.idempotencyKey },
        );
        if (error) {
          return {
            ok: false,
            outcome: classify(error.name, error.statusCode),
            code: error.name,
            message: error.message,
          };
        }
        if (!data?.id) {
          return {
            ok: false,
            outcome: "UNKNOWN",
            code: "NO_MESSAGE_ID",
            message: "Resend accepted the request but returned no message id.",
          };
        }
        return { ok: true, messageId: data.id };
      } catch (error) {
        return {
          ok: false,
          outcome: "UNKNOWN",
          code: "PROVIDER_ERROR",
          message: error instanceof Error ? error.message : "Resend failed.",
        };
      }
    },
  };
}
