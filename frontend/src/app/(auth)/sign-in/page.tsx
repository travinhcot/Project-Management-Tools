import type { Metadata } from "next";
import { SignInFlow } from "@/features/auth/components/SignInFlow";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-line bg-chrome px-[31px] py-[22px]">
        <span className="whitespace-pre text-lg font-bold uppercase text-ink">
          {"NCT Hub  /  Project Management"}
        </span>
        <span className="whitespace-pre text-[13px] font-medium text-muted">{"EN  /  VI"}</span>
      </header>
      <main className="flex flex-1 flex-col items-center gap-8 px-4 pb-20 pt-[72px]">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-[28px] font-bold text-ink">Sign in with your school email</h1>
          <p className="text-sm text-muted">We email you a one-time code. No password needed.</p>
        </div>
        <SignInFlow />
      </main>
    </div>
  );
}
