import { Pill } from "@/shared/components/Pill";
import { signOut } from "@/features/auth/actions";

/** Where "Contact EBMB" writes to. Server-only env var; the button is hidden when unset. */
const contactEmail = process.env.EBMB_CONTACT_EMAIL?.trim() || null;

/** Signed in, but not on the current semester's roster: no project data is shown. */
export function NoAccessCard({
  email,
  semesterName,
}: {
  email: string | null;
  semesterName?: string | null;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <section className="flex w-full max-w-[560px] flex-col items-start gap-3.5 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <Pill tone="warn">
          {semesterName ? `Not on ${semesterName} roster` : "Not on the current roster"}
        </Pill>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">
          You don’t have access this semester
        </h1>
        <p className="text-sm text-muted">
          You’re signed in as{" "}
          <span className="break-all">{email ?? "this account"}</span>, but this email isn’t on
          the current semester’s club roster. Project pages and files are only available to
          members on the active roster.
        </p>
        <div className="flex w-full flex-col gap-1.5 rounded-lg bg-chrome px-3.5 py-3">
          <p className="text-[13px] font-semibold text-ink">What you can do</p>
          <ul className="flex flex-col gap-1.5 text-xs text-muted">
            <li>• Check you signed in with the email you registered with</li>
            <li>• Ask an EBMB admin to add you in the next roster import</li>
            <li>• Your past projects return once you’re back on a roster</li>
          </ul>
        </div>
        <form action={signOut} className="flex flex-wrap items-center gap-2.5">
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}?subject=${encodeURIComponent("Roster access request")}`}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-[18px] py-[11px] text-[13px] font-semibold text-white hover:bg-primary/90"
            >
              Contact EBMB
            </a>
          )}
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg border border-primary bg-surface px-[18px] py-2.5 text-[13px] font-semibold text-accent hover:bg-accent-soft"
          >
            Sign in with another account
          </button>
        </form>
      </section>
    </div>
  );
}
