import { test } from "node:test";
import assert from "node:assert/strict";

import type { RosterMemberRepository } from "../src/modules/members/repository/roster-member.repository.ts";
import { createRosterMemberService } from "../src/modules/members/service/roster-member.service.ts";
import { createRosterMemberBody } from "../src/modules/members/dto/roster-member.dto.ts";

const row = {
  id: "m1", semester_id: "s1", user_id: null, email: "a@x.edu", full_name: "A", major: null,
  status: "ACTIVE" as const, deactivated_at: null, deactivation_reason: null, last_import_id: null,
  created_at: "", updated_at: "",
};
const repo = { add: async () => row } as unknown as RosterMemberRepository;

test("manual add provisions an account and reports it linked", async () => {
  const calls: string[] = [];
  const service = createRosterMemberService(repo, {
    provisionRosterMember: async (id) => (calls.push(id), { status: "linked", detail: "ok" }),
  });
  const { member, account } = await service.add("actor", "s1", { email: "a@x.edu", full_name: "A", major: null }, "r");
  assert.deepEqual(calls, ["m1"]);
  assert.equal(member.linked, true);
  assert.equal(account?.status, "linked");
});

test("manual add still succeeds when provisioning is skipped", async () => {
  const service = createRosterMemberService(repo, {
    provisionRosterMember: async () => ({ status: "skipped", detail: "domain" }),
  });
  const { member, account } = await service.add("actor", "s1", { email: "a@x.edu", full_name: "A", major: null }, "r");
  assert.equal(member.linked, false);
  assert.equal(account?.status, "skipped");
});

test("department must be a known code", () => {
  const base = { email: "a@x.edu", full_name: "An Nguyen" };
  assert.equal(createRosterMemberBody({ ...base, department: "MARCOM" }).department, "MARCOM");
  assert.equal(createRosterMemberBody(base).department, undefined);
  assert.throws(() => createRosterMemberBody({ ...base, department: "Sales" }));
});
