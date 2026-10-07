import { signOut } from "@/features/auth/actions";
import { MemberPageHeader } from "@/features/member/components/MemberPageHeader";
import { getMemberProfile, getMemberStatus } from "@/features/member/service/member.service";
import { formatDay } from "@/features/member/utils/format";
import { Pill } from "@/shared/components/Pill";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-3 text-[13px] sm:flex-row sm:gap-3">
      <dt className="shrink-0 font-medium text-muted sm:w-[180px]">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-ink">{value}</dd>
    </div>
  );
}

export async function MemberProfilePage() {
  const [status, profile] = await Promise.all([getMemberStatus(), getMemberProfile()]);
  const current = profile.semesters.find((semester) => semester.isCurrent);
  const initial = profile.fullName.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase() ?? "?";

  return (
    <div className="flex flex-col gap-[22px]">
      <MemberPageHeader
        breadcrumb={"Workspace  /  Project Management  /  My profile"}
        title="My profile"
        subtitle="Your details as they appear on the club roster."
        semesterName={status.eligible ? current?.name : null}
      />

      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start">
        <section className="flex min-w-0 flex-1 flex-col gap-4 rounded-2xl bg-surface shadow-card p-5">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-bold text-accent"
            >
              {initial}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="break-words text-xl font-semibold text-ink">{profile.fullName}</p>
              <div className="flex flex-wrap gap-2">
                <Pill tone="accent" size="sm">
                  Member
                </Pill>
                {profile.department && (
                  <Pill tone="cyan" size="sm">
                    ▤ {profile.department}
                  </Pill>
                )}
              </div>
            </div>
          </div>
          <div className="h-px bg-line" />
          <dl className="flex flex-col">
            <Field label="Full name" value={profile.fullName} />
            <Field label="Email" value={profile.email} />
            <Field label="Department" value={profile.department ?? "Not set"} />
            <Field label="Hub role" value="Member · no admin permissions" />
          </dl>
          <p className="text-xs text-muted">
            These details come from the semester roster import. To correct anything, ask an EBMB
            admin.
          </p>
        </section>

        <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[360px]">
          <section className="flex flex-col gap-2.5 rounded-2xl bg-surface shadow-card p-5">
            <h2 className="text-[17px] font-semibold text-ink">Semester access</h2>
            {profile.semesters.length === 0 && (
              <p className="text-xs text-muted">You are not on any semester roster yet.</p>
            )}
            {profile.semesters.map((semester) => (
              <div key={semester.id} className="flex flex-col gap-1 rounded-lg bg-chrome px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-ink">{semester.name}</p>
                  {semester.isCurrent ? (
                    <Pill tone="success" size="sm">
                      ● Current
                    </Pill>
                  ) : (
                    <Pill tone="neutral" size="sm">
                      Past
                    </Pill>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {semester.projectCount} {semester.projectCount === 1 ? "project" : "projects"}
                  {" · "}
                  {semester.isCurrent
                    ? semester.endsOn
                      ? `access until ${formatDay(semester.endsOn)}`
                      : "access this semester"
                    : "read-only history"}
                </p>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-2.5 rounded-2xl bg-surface shadow-card p-5">
            <h2 className="text-[17px] font-semibold text-ink">Preferences</h2>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-muted">Language</p>
              <div className="flex rounded-full bg-chrome p-0.5" role="group" aria-label="Language">
                <span
                  aria-current="true"
                  className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-accent"
                >
                  English
                </span>
                <span
                  aria-disabled="true"
                  title="Vietnamese is not available yet"
                  className="rounded-full px-3 py-1 text-xs font-medium text-muted"
                >
                  Tiếng Việt
                </span>
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-[13px] font-semibold text-danger-text hover:underline"
              >
                Sign out
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
