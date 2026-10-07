import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildContext } from "../src/modules/emails/template/context.ts";
import { renderEmail } from "../src/modules/emails/template/render-email.ts";

const source = {
  subject: "Project kick-off",
  recipientName: "An",
  projectId: "p1",
  projectName: "Open Bench",
  semesterName: "Sem A 2026",
  demoUrl: null,
};

describe("kick-off email", () => {
  it("includes the meeting link next to the project link", () => {
    const rendered = renderEmail(
      "KICKOFF",
      buildContext(
        { ...source, meetingUrl: "https://meet.example.edu/room" },
        "http://localhost:5173",
      ),
    );
    assert.match(rendered.text, /https:\/\/meet\.example\.edu\/room/);
    assert.match(rendered.html, /href="https:\/\/meet\.example\.edu\/room"/);
    assert.match(rendered.text, /localhost:5173\/projects\/p1/);
  });

  it("omits the meeting block when no link is set", () => {
    const rendered = renderEmail(
      "KICKOFF",
      buildContext(source, "http://localhost:5173"),
    );
    assert.doesNotMatch(rendered.text, /kick-off meeting/);
  });
});
