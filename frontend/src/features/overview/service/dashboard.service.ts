// getDashboard() returns mock data until auth is wired; swap in
// GET /api/admin/dashboard (+ /api/admin/projects for the project cards).
import type { Dashboard } from "@/features/overview/models/dashboard";

export async function getDashboard(): Promise<Dashboard> {
  return {
    semester: { id: "sem-a", name: "Sem A", active: true },
    roster: { active: 52 },
    projects: { software: 5, hardware: 3, total: 8 },
    warnings: [
      {
        id: "w1",
        message: "Circuit Lab has no assigned members",
        hint: "Assign members from the Sem A roster",
        link: "/projects",
      },
      {
        id: "w2",
        message: "Open Bench is missing a BOM",
        hint: "Add a file or secure external URL",
        link: "/projects",
      },
    ],
    recentProjects: [
      {
        id: "p1",
        name: "Smart Campus API",
        type: "software",
        description: "Shared project resources and first meeting details.",
        memberCount: 6,
        kickoffAt: "2026-10-12",
      },
      {
        id: "p2",
        name: "Open Bench",
        type: "hardware",
        description: "Prototype workspace and bill of materials.",
        memberCount: 4,
        kickoffAt: "2026-10-15",
      },
      {
        id: "p3",
        name: "Club Tools",
        type: "software",
        description: "Development brief and first meeting details.",
        memberCount: 5,
        kickoffAt: "2026-10-20",
      },
    ],
  };
}
