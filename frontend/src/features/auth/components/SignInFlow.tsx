"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/shared/components/Button";
import { Field, TextInput } from "@/shared/components/Field";
import { requestOtp, verifyOtp } from "@/features/auth/actions";
import { OTP_LENGTH, OtpInput } from "@/features/auth/components/OtpInput";

type Step = "email" | "code" | "no-access";

const RESEND_SECONDS = 45;

const cardClass =
  "flex w-full max-w-[380px] flex-col gap-4 rounded-[14px] border border-line bg-surface p-5 sm:p-7";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export function SignInFlow() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await requestOtp(email);
      if (!result.ok) return setError(result.message);
      setCode("");
      setCooldown(RESEND_SECONDS);
      setStep("code");
    });
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (code.length < OTP_LENGTH) return setError(`Enter the ${OTP_LENGTH}-digit code.`);
    setError(undefined);
    startTransition(async () => {
      // On success the action redirects, so this only resumes on failure.
      const result = await verifyOtp(email, code);
      if (result.ok) return;
      if (result.code === "NO_ACCESS") return setStep("no-access");
      setError(result.message);
    });
  }

  if (step === "no-access") {
    return (
      <section className={cardClass} aria-label="No access">
        <p className="text-[11px] font-bold uppercase text-warn-text">Signed in · no access</p>
        <h2 className="text-xl font-bold text-ink">This account cannot use the admin area</h2>
        <p className="text-[13px] text-muted">
          Your account works, but only EBMB admins can open this workspace. Members see their
          projects in the member portal. If you should be an admin, ask an EBMB contact.
        </p>
        <div>
          <Button
            variant="outline"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(undefined);
            }}
          >
            Use a different email
          </Button>
        </div>
      </section>
    );
  }

  if (step === "code") {
    return (
      <form noValidate onSubmit={submitCode} className={cardClass} aria-label="Enter your code">
        <p className="text-[11px] font-bold text-accent">STEP 2</p>
        <h2 className="text-xl font-bold text-ink">Enter your code</h2>
        <p className="break-all text-[13px] text-muted">Sent to {email.trim()}</p>
        <OtpInput value={code} onChange={setCode} disabled={pending} invalid={Boolean(error)} />
        <Button type="submit" disabled={pending} className="h-11 w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <div className="flex flex-wrap gap-4">
          <Button
            variant="ghost"
            disabled={pending || cooldown > 0}
            onClick={() => sendCode()}
            className="h-10 px-0 hover:bg-transparent"
          >
            {cooldown > 0 ? `Resend code in ${clock(cooldown)}` : "Resend code"}
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setStep("email");
              setError(undefined);
            }}
            className="h-10 px-0 hover:bg-transparent"
          >
            Use a different email
          </Button>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form noValidate onSubmit={sendCode} className={cardClass} aria-label="Get a sign-in code">
      <p className="text-[11px] font-bold text-accent">STEP 1</p>
      <h2 className="text-xl font-bold text-ink">Get a sign-in code</h2>
      <Field label="School email" htmlFor="sign-in-email" error={error}>
        <TextInput
          id="sign-in-email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="s1234567@student.example.edu"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
        />
      </Field>
      <Button type="submit" disabled={pending || !email.trim()} className="h-11 w-full">
        {pending ? "Sending…" : "Send code"}
      </Button>
      <p className="text-xs text-muted">
        Only emails on the current roster, or EBMB admins, receive a code. We show the same
        message either way.
      </p>
    </form>
  );
}
