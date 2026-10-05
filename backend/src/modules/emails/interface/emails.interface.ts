import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailsOptions } from "../model/email.model.ts";

export type { KickoffGateway, EmailProvider } from "../model/email.model.ts";

export { createResendEmailProvider } from "../provider/resend.provider.ts";
import { createConsoleEmailProvider } from "../provider/console.provider.ts";
import { createEmailRepository } from "../repository/email.repository.ts";
import { createCampaignService } from "../service/campaign.service.ts";
import { createProcessorService } from "../service/processor.service.ts";
import { createCampaignAdminRouter } from "../routes/campaign-admin.routes.ts";
import { createCampaignInternalRouter } from "../routes/campaign-internal.routes.ts";

const DEFAULT_BATCH_SIZE = 25;

/** Public emails-module entry point. Only composition roots import this file. */
export function createEmailsInterface(
  databaseClient: SupabaseClient,
  options: EmailsOptions,
) {
  const repository = createEmailRepository(databaseClient);
  const service = createCampaignService(repository, {
    appUrl: options.appUrl,
  });
  const processor = createProcessorService(
    repository,
    options.provider ?? createConsoleEmailProvider(),
    {
      appUrl: options.appUrl,
      batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
    },
  );
  return {
    adminRouter: createCampaignAdminRouter(service),
    internalRouter: createCampaignInternalRouter(
      processor,
      options.internalSecret,
    ),
    kickoffs: service.kickoffs,
  };
}

export type EmailsInterface = ReturnType<typeof createEmailsInterface>;
