import type { Metadata } from "next";
import { MembersPage } from "@/features/members/pages/MembersPage";
import { getMembers } from "@/features/members/service/members.service";

export const metadata: Metadata = { title: "Members" };

export default async function Page() {
  const { semester, members } = await getMembers();
  return <MembersPage semester={semester} initialMembers={members} />;
}
