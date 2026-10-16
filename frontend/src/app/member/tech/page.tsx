import type { Metadata } from "next";
import { MemberOverviewPage } from "@/features/member/pages/MemberOverviewPage";

export const metadata: Metadata = { title: "Tech overview" };

export default function Page() {
  return <MemberOverviewPage department="TECH" />;
}
