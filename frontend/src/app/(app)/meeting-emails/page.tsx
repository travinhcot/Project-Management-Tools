import type { Metadata } from "next";
import { MeetingEmailsPage } from "@/features/meeting-emails/pages/MeetingEmailsPage";
import { getMeetingEmails } from "@/features/meeting-emails/service/meeting-emails.service";
import { getSemesterOptions } from "@/features/semesters/service/semesters.service";

export const metadata: Metadata = { title: "Meeting emails" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ semester?: string | string[] }>;
}) {
  const { semester } = await searchParams;
  const semesterId = typeof semester === "string" ? semester.trim().slice(0, 64) : undefined;
  const [{ semester: selected, projects }, semesters] = await Promise.all([
    getMeetingEmails(semesterId || undefined),
    getSemesterOptions(),
  ]);
  return <MeetingEmailsPage semester={selected} projects={projects} semesters={semesters} />;
}
