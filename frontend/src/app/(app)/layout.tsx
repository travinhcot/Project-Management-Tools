import { Sidebar } from "@/shared/components/navigation/Sidebar";
import { TopBar } from "@/shared/components/navigation/TopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 p-11">{children}</main>
      </div>
    </div>
  );
}
