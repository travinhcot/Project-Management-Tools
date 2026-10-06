import type { Metadata } from "next";
import { SemestersPage } from "@/features/semesters/pages/SemestersPage";
import { getSemesters } from "@/features/semesters/service/semesters.service";

export const metadata: Metadata = { title: "Semesters" };

export default async function Page() {
  const { semesters, today } = await getSemesters();
  return <SemestersPage semesters={semesters} today={today} />;
}
