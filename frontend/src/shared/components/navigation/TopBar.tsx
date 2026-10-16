import { Pill } from "@/shared/components/Pill";
import { MobileNav } from "@/shared/components/navigation/MobileNav";
import { signOut } from "@/features/auth/actions";

export function TopBar({
  userLabel,
  workspaceLabel = "Technology Department workspace",
  nav,
}: {
  /** Signed-in member shown as a pill (e.g. "Bùi Hoàng Nam · Member"); admins show "EBMB". */
  userLabel?: string;
  /** Text next to the pills: the department a department admin works in, or "All departments". */
  workspaceLabel?: string;
  nav?: React.ComponentProps<typeof MobileNav>;
}) {
  return (
    <header className="flex min-h-[68px] shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border border-line bg-topbar px-4 py-2 sm:px-[30px]">
      <MobileNav {...nav} />
      <img src="/landing/logo.png" alt="" className="h-8 w-auto object-contain" />
      <span className="-ml-3 text-base font-bold uppercase text-ink sm:text-lg">
        Project Management
      </span>
      <div className="flex-1" />
      <span className="hidden text-[13px] font-medium text-muted sm:inline">
        {workspaceLabel}
      </span>
      <Pill tone="accent">{userLabel ?? "EBMB"}</Pill>
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
