import type {
  AuditPort,
  ProfileProvisioner,
  ProvisionCandidate,
  ProvisionResult,
  ProvisioningSummary,
} from "../model/roster-import.model.ts";
import type { RosterProvisionRepository } from "../repository/roster-provision.repository.ts";

import { HttpError } from "../../../shared/http-error.ts";
import { emailDomainAllowed, emailProblem, normalizeEmail } from "../../../shared/roster-rules.ts";

/** Accounts created inside one HTTP request; the rest is left to `provision:roster`. */
export const MAX_INLINE_PROVISION = 200;

const reasonOf = (error: unknown): string =>
  error instanceof HttpError
    ? `${error.code}: ${error.message}`
    : error instanceof Error
      ? error.message
      : JSON.stringify(error);

export function createRosterProvisionService(
  repository: RosterProvisionRepository,
  profiles: ProfileProvisioner,
  audit?: AuditPort,
) {
  /** Gives each person an Auth user, a MEMBER profile in their roster department, and the link. */
  async function provisionMembers(
    members: readonly ProvisionCandidate[],
    { dryRun = false }: { dryRun?: boolean } = {},
  ): Promise<ProvisionResult[]> {
    const results: ProvisionResult[] = [];
    for (const member of members) {
      const email = normalizeEmail(member.email);
      const done = (status: ProvisionResult["status"], detail: string) =>
        results.push({ email, full_name: member.full_name, status, detail });
      try {
        if (emailProblem(email)) {
          done("skipped", "invalid email");
          continue;
        }
        if (!emailDomainAllowed(email)) {
          done("skipped", "domain is not in ALLOWED_EMAIL_DOMAINS");
          continue;
        }
        let profileId = await repository.profileId(email);
        if (dryRun) {
          done("would", profileId ? "link roster" : "create account, link roster");
          continue;
        }
        if (!profileId) {
          const authId = await repository.ensureAuthUser(email);
          const profile = await profiles.provisionVerifiedProfile(
            { id: authId, email, email_verified_at: new Date().toISOString() },
            member.full_name,
            "MEMBER",
            member.department ?? undefined,
          );
          profileId = profile.id;
        }
        await repository.link(email, profileId);
        done("linked", "ok");
      } catch (error) {
        done("failed", reasonOf(error));
      }
    }
    return results;
  }

  return {
    provisionMembers,
    unlinkedForSemester: (semesterId: string) => repository.listUnlinked(semesterId),

    /** After an import commit: never throws, so a committed import is never reported as failed. */
    async provisionImport(
      importId: string,
      context: { actorId: string; semesterId: string | null; requestId: string },
    ): Promise<ProvisioningSummary> {
      try {
        const candidates = await repository.listImported(importId);
        const batch = candidates.slice(0, MAX_INLINE_PROVISION);
        const results = await provisionMembers(batch);
        const count = (status: ProvisionResult["status"]) =>
          results.filter((result) => result.status === status).length;
        const summary: ProvisioningSummary = {
          linked: count("linked"),
          skipped: count("skipped"),
          failed: count("failed"),
          remaining: candidates.length - batch.length,
          failures: results
            .filter((result) => result.status !== "linked")
            .map((result) => ({ email: result.email, reason: result.detail })),
        };
        if (audit && candidates.length > 0) {
          await audit
            .record({
              actorId: context.actorId,
              action: "ROSTER_MEMBERS_PROVISIONED",
              entityType: "ROSTER_IMPORT",
              entityId: importId,
              semesterId: context.semesterId,
              metadata: {
                linked: summary.linked,
                skipped: summary.skipped,
                failed: summary.failed,
                remaining: summary.remaining,
              },
              requestId: context.requestId,
            })
            .catch(() => undefined);
        }
        return summary;
      } catch (error) {
        console.error("Roster provisioning failed:", reasonOf(error));
        return { linked: 0, skipped: 0, failed: 0, remaining: 0, failures: [], error: true };
      }
    },
  };
}

export type RosterProvisionService = ReturnType<typeof createRosterProvisionService>;
