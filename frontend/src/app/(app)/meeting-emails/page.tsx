import type { Metadata } from "next";
import { MeetingEmailsPage } from "@/features/meeting-emails/pages/MeetingEmailsPage";
import { getMeetingEmails } from "@/features/meeting-emails/service/meeting-emails.service";

export const metadata: Metadata = { title: "Meeting emails" };

export default async function Page() {
  const { semester, projects } = await getMeetingEmails();
  return <MeetingEmailsPage semester={semester} initialProjects={projects} />;
}
