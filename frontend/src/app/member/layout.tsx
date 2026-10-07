import { memberNav } from "@/config/navigation";
import { getMemberStatus } from "@/features/member/service/member.service";
import { Sidebar } from "@/shared/components/navigation/Sidebar";
import { TopBar } from "@/shared/components/navigation/TopBar";

const HEADING = "MEMBER";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const status = await getMemberStatus();
  // Without a roster entry only the profile stays usable.
  const disabledHrefs = status.eligible
    ? []
    : memberNav.filter((item) => item.href !== "/member/profile").map((item) => item.href);
  const who = status.fullName ?? status.email;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar
        userLabel={who ? `${who} · Member` : "Member"}
        nav={{ heading: HEADING, items: memberNav, disabledHrefs }}
      />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar
          heading={HEADING}
          items={memberNav}
          disabledHrefs={disabledHrefs}
          toolHref="/member/overview"
          note={
            status.eligible
              ? {
                  title: "Member access",
                  body: "You can view projects you are assigned to. Ask an EBMB admin to change teams or resources.",
                }
              : undefined
          }
        />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-11">{children}</main>
      </div>
    </div>
  );
}
