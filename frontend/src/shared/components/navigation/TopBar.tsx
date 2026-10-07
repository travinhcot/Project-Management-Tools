import { Pill } from "@/shared/components/Pill";
import { signOut } from "@/features/auth/actions";

export function TopBar() {
  return (
    <header className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border border-line bg-chrome px-4 py-2 sm:px-[30px]">
      <span className="text-base font-bold uppercase text-ink sm:text-lg">
        Project Management
      </span>
      <div className="flex-1" />
      <span className="hidden text-[13px] font-medium text-muted sm:inline">
        Dept Tech workspace
      </span>
      <Pill>EN / VI</Pill>
      <Pill tone="accent">EBMB</Pill>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-line/50 hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}
