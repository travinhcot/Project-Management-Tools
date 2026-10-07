import type { Metadata } from "next";
import { MemberProjectPage } from "@/features/member/pages/MemberProjectPage";

export const metadata: Metadata = { title: "Project" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberProjectPage id={id} />;
}
