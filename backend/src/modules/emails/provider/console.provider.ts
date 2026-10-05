import type { EmailProvider } from "../model/email.model.ts";

import { randomUUID } from "node:crypto";

/** Stand-in provider: logs the message instead of sending it. Swap for a real adapter later. */
export function createConsoleEmailProvider(): EmailProvider {
  return {
    async send(message) {
      console.log(
        `[email] to=${message.to} subject=${JSON.stringify(message.subject)} key=${message.idempotencyKey}`,
      );
      return { ok: true, messageId: `console-${randomUUID()}` };
    },
  };
}
