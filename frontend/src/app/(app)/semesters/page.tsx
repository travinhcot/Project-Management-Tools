import type { Metadata } from "next";
import { SemestersPage } from "@/features/semesters/pages/SemestersPage";
import { getSemesters } from "@/features/semesters/service/semesters.service";
import { getViewer } from "@/shared/auth/viewer";

export const metadata: Metadata = { title: "Semesters" };

export default async function Page() {
  const [viewer, { semesters, today }] = await Promise.all([getViewer(), getSemesters()]);
  return <SemestersPage semesters={semesters} today={today} canManage={viewer.role === "ADMIN"} />;
}
