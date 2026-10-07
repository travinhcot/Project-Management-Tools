import type { Metadata } from "next";
import { SignInFlow } from "@/features/auth/components/SignInFlow";
import { safeNextPath } from "@/shared/auth/redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNextPath((await searchParams).next);
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-topbar px-4 py-4 sm:px-[31px] sm:py-[22px]">
        <span className="whitespace-pre-wrap text-base font-bold uppercase text-ink sm:text-lg">
          {"NCT Hub  /  Project Management"}
        </span>
        <span className="whitespace-pre text-[13px] font-medium text-muted">{"EN  /  VI"}</span>
      </header>
      <main className="flex flex-1 flex-col items-center bg-hub gap-8 px-4 pb-20 pt-10 sm:pt-[72px]">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-2xl font-bold sm:text-[28px] text-ink">Sign in with your school email</h1>
          <p className="text-sm text-muted">We email you a one-time code. No password needed.</p>
        </div>
        <SignInFlow
          next={next}
          allowedDomains={allowedDomains}
          contactEmail={process.env.EBMB_CONTACT_EMAIL?.trim() || undefined}
        />
      </main>
    </div>
  );
}
