import type { CampaignKind } from "../model/email.model.ts";
import type { RenderedEmail, TemplateContext } from "./render.ts";

import { renderDemo } from "./demo.template.ts";
import { renderKickoff } from "./kickoff.template.ts";

/** The fixed template set. The SQL side stores template_key/template_version per campaign. */
export function renderEmail(
  kind: CampaignKind,
  context: TemplateContext,
): RenderedEmail {
  return kind === "KICKOFF" ? renderKickoff(context) : renderDemo(context);
}
