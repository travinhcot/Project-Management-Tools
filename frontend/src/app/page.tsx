import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/components/LandingPage";

export const metadata: Metadata = {
  title: "Neo Culture Tech · Project Management App",
  description: "Manage projects and let every member track the projects they are working on.",
};

export default function Home() {
  return <LandingPage />;
}
