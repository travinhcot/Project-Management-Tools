import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpError } from "../src/shared/http-error.ts";
import {
  createProjectBody,
  listProjectsQuery,
  updateProjectBody,
} from "../src/modules/projects/dto/project-admin.dto.ts";
import {
  assignMembersBody,
  memberRoleBody,
} from "../src/modules/projects/dto/project-member.dto.ts";
import { scheduleOrSendNowBody } from "../src/modules/emails/dto/campaign-admin.dto.ts";
import {
  createRosterMemberBody,
  listRosterQuery,
} from "../src/modules/members/dto/roster-member.dto.ts";
import { parseRosterCsv } from "../src/modules/roster/csv/roster-csv.ts";

const SEMESTER = "11111111-1111-4111-8111-111111111111";
const PERSON = "22222222-2222-4222-8222-222222222222";
const badRequest = (error: unknown) =>
  error instanceof HttpError && error.status === 400;

describe("project status", () => {
  it("defaults to null on create and accepts a valid status", () => {
    const base = { semester_id: SEMESTER, name: "Atlas", type: "SOFTWARE" };
    assert.equal(createProjectBody(base).status, null);
    assert.equal(createProjectBody({ ...base, status: "ONGOING" }).status, "ONGOING");
  });

  it("rejects an unknown status", () => {
    assert.throws(
      () =>
        createProjectBody({
          semester_id: SEMESTER,
          name: "Atlas",
          type: "SOFTWARE",
          status: "DONE",
        }),
      badRequest,
    );
    assert.throws(() => listProjectsQuery({ status: "DONE" }), badRequest);
  });

  it("allows status in an update and filters the list by it", () => {
    const update = updateProjectBody({
      expected_updated_at: "2026-10-01T00:00:00Z",
      status: "COMPLETED",
    });
    assert.equal(update.changes.status, "COMPLETED");
    assert.equal(listProjectsQuery({ status: "FAILED" }).status, "FAILED");
  });
});

describe("project leader", () => {
  it("lets one person be assigned as leader", () => {
    const request = assignMembersBody({ roster_member_id: PERSON, role: "LEADER" });
    assert.equal(request.role, "LEADER");
    assert.equal(assignMembersBody({ roster_member_id: PERSON }).role, "MEMBER");
  });

  it("rejects LEADER in a bulk assignment", () => {
    assert.throws(
      () => assignMembersBody({ roster_member_ids: [PERSON], role: "LEADER" }),
      badRequest,
    );
  });

  it("validates the role body", () => {
    assert.deepEqual(memberRoleBody({ role: "MEMBER" }), { role: "MEMBER" });
    assert.throws(() => memberRoleBody({ role: "BOSS" }), badRequest);
    assert.throws(() => memberRoleBody({}), badRequest);
  });
});

describe("send now", () => {
  it("accepts exactly one of scheduled_at or send_now", () => {
    assert.deepEqual(scheduleOrSendNowBody({ send_now: true }), {
      scheduledAt: null,
      sendNow: true,
    });
    const scheduled = scheduleOrSendNowBody({ scheduled_at: "2030-01-01" });
    assert.equal(scheduled.sendNow, false);
    assert.ok(scheduled.scheduledAt?.startsWith("2030-01-01"));
  });

  it("rejects both, neither, or a non-boolean send_now", () => {
    assert.throws(
      () => scheduleOrSendNowBody({ send_now: true, scheduled_at: "2030-01-01" }),
      badRequest,
    );
    assert.throws(() => scheduleOrSendNowBody({}), badRequest);
    assert.throws(() => scheduleOrSendNowBody({ send_now: "yes" }), badRequest);
    assert.throws(
      () => scheduleOrSendNowBody({ send_now: false }),
      badRequest,
    );
  });
});

describe("roster major", () => {
  it("reads and trims the major on create", () => {
    const member = createRosterMemberBody({
      email: "a@example.com",
      full_name: "A",
      major: "  Robotics  ",
    });
    assert.equal(member.major, "Robotics");
    assert.equal(createRosterMemberBody({ email: "a@example.com", full_name: "A" }).major, null);
  });

  it("rejects fields that are no longer part of the roster", () => {
    const body = { email: "a@example.com", full_name: "A" };
    assert.throws(() => createRosterMemberBody({ ...body, department: "Software" }), badRequest);
    assert.throws(() => createRosterMemberBody({ ...body, birth_year: 2003 }), badRequest);
    assert.throws(() => createRosterMemberBody({ ...body, other_info: {} }), badRequest);
    assert.throws(() => listRosterQuery(SEMESTER, { department: "Software" }), badRequest);
  });

  it("imports the optional major column and ignores the removed ones", () => {
    const { rows, ignored_columns } = parseRosterCsv(
      [
        "Full Name,Email,Major,Department,Birth Year,Student ID",
        "Alice,alice@example.com,Robotics,Software,2003,S1",
        "Bob,bob@example.com,,,,",
      ].join("\n"),
    );
    assert.equal(rows[0]?.major, "Robotics");
    assert.equal(rows[1]?.major, null);
    assert.equal(rows[0]?.status, "VALID");
    assert.deepEqual(ignored_columns, ["Department", "Birth Year", "Student ID"]);
  });

  it("still imports files without a major column", () => {
    const { rows } = parseRosterCsv("Full Name,Email\nAlice,alice@example.com");
    assert.equal(rows[0]?.status, "VALID");
    assert.equal(rows[0]?.major, null);
  });
});
