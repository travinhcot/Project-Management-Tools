import { Noto_Sans, Poppins } from "next/font/google";
import { LoadingLink } from "./LoadingLink";
import { LandingNav } from "./LandingNav";
import { Reveal } from "./Reveal";
import { SmoothAnchor } from "./SmoothAnchor";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const notoSans = Noto_Sans({
  variable: "--font-noto",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

const FEATURES = [
  {
    number: "01",
    title: "Manage projects",
    body: "Create projects for each semester, set type and status, and assign leaders and members straight from the active roster.",
    tone: "cyan",
  },
  {
    number: "02",
    title: "Track your current projects",
    body: "Members see the projects they’re part of, with kick-off dates, BOM files and meeting links — no more digging through group chats.",
    tone: "yellow",
  },
  {
    number: "03",
    title: "Run the semester",
    body: "Switch semesters, import rosters, send first-meeting emails and keep an audit log of every change.",
    tone: "cyan",
  },
] as const;

function Brand({ size }: { size: "lg" | "sm" }) {
  const large = size === "lg";
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing/logo.png"
        alt=""
        className="h-11 w-11 object-contain"
      />
      <div className="flex flex-col gap-[3px]">
        <span
          className={`font-extrabold leading-none text-[#f2f7fc] ${large ? "text-[14px] tracking-[0.28px] md:text-[17px] md:tracking-[0.34px]" : "text-[14px] tracking-[0.28px]"}`}
          style={{ fontFamily: "var(--font-poppins)" }}
        >
          NEO CULTURE <span className="text-[#6ce7ff]">TECH</span>
        </span>
      </div>
    </div>
  );
}

function PrimaryCta({ className = "" }: { className?: string }) {
  return (
    <LoadingLink
      href="/sign-in"
      className={`inline-flex items-center justify-center whitespace-pre rounded-xl bg-[#6ce7ff] px-[26px] py-[15px] text-base font-semibold text-[#171624] shadow-[0_10px_30px_-10px_rgba(108,231,255,0.6)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-10px_rgba(108,231,255,0.8)] ${className}`}
    >
      {"Go to Project Management  →"}
    </LoadingLink>
  );
}

export function LandingPage() {
  return (
    <div
      className={`${poppins.variable} ${notoSans.variable} min-h-screen overflow-x-hidden bg-[#171624] text-[#f2f7fc]`}
      style={{ fontFamily: "var(--font-noto), system-ui, sans-serif" }}
    >
      {/* Intro splash: the logo spins, then the curtain lifts to reveal the page. */}
      <div
        aria-hidden="true"
        className="nct-splash pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#171624]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/logo.png" alt="" className="nct-splash-logo h-24 w-24 object-contain" />
      </div>

      <header className="nct-fade-down relative flex items-center justify-between border-b border-[#f2f7fc]/[0.06] px-5 py-3.5 md:px-8 md:py-[22px] lg:px-12">
        <Brand size="lg" />
        <LandingNav />
      </header>

      <main>
        <section className="relative flex flex-col items-center gap-[22px] overflow-hidden px-5 pb-[72px] pt-16 text-center md:gap-7 md:px-20 md:py-[140px]">
          <div
            aria-hidden="true"
            className="nct-glow pointer-events-none absolute left-1/2 top-[-110px] h-[520px] w-[640px] -translate-x-1/2 md:top-[-120px] md:h-[760px] md:w-[1200px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/glow-desktop.svg" alt="" className="size-full" />
          </div>

          <h1
            className="relative text-[min(36px,8.4vw)] font-extrabold uppercase leading-[1.08] tracking-[-0.36px] md:text-[78px] md:leading-[1.04] md:tracking-[-0.78px]"
            style={{ fontFamily: "var(--font-poppins)" }}
          >
            <span className="nct-rise block text-[#f2f7fc]" style={{ animationDelay: "1050ms" }}>
              Neo Culture Tech
            </span>
            <span className="nct-rise block text-[#6ce7ff]" style={{ animationDelay: "1200ms" }}>
              Project <span className="block md:inline">Management</span>
            </span>
          </h1>

          <span
            className="nct-bar relative h-[5px] w-[262px] rounded-[3px] bg-[#ffe120] md:h-1.5 md:w-full md:max-w-[934px]"
            style={{ animationDelay: "1400ms" }}
          />

          <p
            className="nct-rise relative max-w-[700px] text-base leading-[1.55] text-[#a7acc3] md:text-xl"
            style={{ animationDelay: "1550ms" }}
          >
            One place for every Dept Tech project. The app helps the club manage its projects and
            lets each member track the projects they’re currently working on — leaders, teammates,
            kick-off dates and resources included.
          </p>

          <div
            className="nct-rise relative flex w-full flex-col gap-3 md:w-auto md:flex-row md:gap-3.5"
            style={{ animationDelay: "1700ms" }}
          >
            <PrimaryCta />
            <SmoothAnchor
              href="#features"
              className="inline-flex items-center justify-center rounded-xl border-[1.5px] border-[#f2f7fc]/[0.28] px-[26px] py-[15px] text-base font-semibold text-[#f2f7fc] transition hover:border-[#6ce7ff] hover:text-[#6ce7ff]"
            >
              Explore features
            </SmoothAnchor>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-4 bg-[#1f1d31] px-5 py-16 md:px-20 md:py-[104px]"
        >
          <Reveal className="flex flex-col gap-3.5">
            <p className="text-[13px] font-semibold tracking-[1.56px] text-[#ffe120]">WHAT IT DOES</p>
            <h2
              className="max-w-[640px] text-[28px] font-bold leading-[1.18] md:max-w-none md:text-[42px]"
              style={{ fontFamily: "var(--font-poppins)" }}
            >
              Everything a club project needs, in one hub
            </h2>
            <p className="max-w-[640px] text-base leading-[1.55] text-[#a7acc3] md:text-lg">
              Admins keep projects, rosters and semesters organised. Members always know which
              projects they’re on and what happens next.
            </p>
          </Reveal>

          <div className="mt-8 grid gap-3.5 md:mt-12 md:grid-cols-3 md:gap-5">
            {FEATURES.map((feature, index) => (
              <Reveal key={feature.number} delay={index * 130} className="h-full">
                <article className="flex h-full flex-col items-start gap-4 rounded-[18px] border border-[#f2f7fc]/[0.07] bg-[#171624] p-[22px] transition duration-300 hover:-translate-y-1.5 hover:border-[#6ce7ff]/40 md:p-7">
                  <span
                    className={`rounded-xl px-3.5 py-2.5 text-lg font-bold ${
                      feature.tone === "yellow"
                        ? "bg-[#ffe120]/[0.12] text-[#ffe120]"
                        : "bg-[#6ce7ff]/[0.12] text-[#6ce7ff]"
                    }`}
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    {feature.number}
                  </span>
                  <h3
                    className="text-[21px] font-semibold"
                    style={{ fontFamily: "var(--font-poppins)" }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-[15px] leading-[1.55] text-[#a7acc3]">{feature.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="cta" className="scroll-mt-4 px-5 py-14 md:px-20 md:py-24">
          <Reveal>
            <div className="flex flex-col items-start gap-[22px] rounded-3xl border border-[#6ce7ff]/35 bg-[#26243b] px-[22px] py-7 md:flex-row md:items-center md:justify-between md:px-14 md:py-12">
              <div className="flex flex-col gap-2.5">
                <p
                  className="text-2xl font-bold md:text-[34px]"
                  style={{ fontFamily: "var(--font-poppins)" }}
                >
                  Ready to check on your <span className="text-[#6ce7ff]">projects</span>?
                </p>
                <p className="text-[15px] text-[#a7acc3] md:text-[17px]">
                  Sign in with your club account to see this semester’s projects.
                </p>
              </div>
              <PrimaryCta className="w-full md:w-auto" />
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="flex flex-col items-center gap-4 border-t border-[#f2f7fc]/[0.06] px-5 py-7 md:flex-row md:justify-between md:px-20 md:py-8">
        <Brand size="sm" />
        <p className="text-center text-[13px] text-[#7c8099] md:text-sm">
          © 2026 NEO Culture Technology Club · RMIT Vietnam
        </p>
      </footer>
    </div>
  );
}
