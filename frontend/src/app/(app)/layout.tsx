import { workspaceNavFor } from "@/config/navigation";
import { Sidebar } from "@/shared/components/navigation/Sidebar";
import { TopBar } from "@/shared/components/navigation/TopBar";
import { DEPARTMENT_WORKSPACE_LABELS } from "@/config/departments";
import { getViewer } from "@/shared/auth/viewer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const items = workspaceNavFor(viewer.role);
  const departmentAdmin = viewer.role === "DEPT_ADMIN";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar
        userLabel={departmentAdmin ? `${viewer.departmentLabel} admin` : undefined}
        workspaceLabel={
          departmentAdmin && viewer.departmentCode
            ? DEPARTMENT_WORKSPACE_LABELS[viewer.departmentCode]
            : "All departments"
        }
        nav={{ items }}
      />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar items={items} />
        <main className="min-w-0 flex-1 bg-hub p-4 sm:p-6 lg:p-11">{children}</main>
      </div>
    </div>
  );
}
