import { Pill } from "@/shared/components/Pill";
import { signOut } from "@/features/auth/actions";

export function TopBar() {
  return (
    <header className="flex h-[68px] shrink-0 items-center gap-5 border border-line bg-chrome px-[30px]">
      <span className="text-lg font-bold uppercase text-ink">
        Project Management
      </span>
      <div className="flex-1" />
      <span className="text-[13px] font-medium text-muted">
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
