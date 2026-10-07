import type { CampaignKind } from "../model/email.model.ts";
import type { RenderedEmail, TemplateContext } from "./render.ts";

import { renderDemo } from "./demo.template.ts";
import { renderKickoff } from "./kickoff.template.ts";
import { renderProjectResources } from "./project-resources.template.ts";

/** The fixed template set. The SQL side stores template_key/template_version per campaign. */
export function renderEmail(
  kind: CampaignKind,
  context: TemplateContext,
): RenderedEmail {
  switch (kind) {
    case "KICKOFF":
      return renderKickoff(context);
    case "PROJECT_RESOURCES":
      return renderProjectResources(context);
    case "DEMO":
      return renderDemo(context);
  }
}
