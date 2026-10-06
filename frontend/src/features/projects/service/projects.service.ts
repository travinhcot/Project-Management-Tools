// getProjects() returns mock data until auth is wired; swap in
// GET /api/admin/projects (semester, items[]) and map snake_case to Project.
import type {
  Project,
  SemesterSummary,
} from "@/features/projects/models/project";

export async function getProjects(): Promise<{
  semester: SemesterSummary;
  projects: Project[];
}> {
  return {
    semester: { id: "sem-a", name: "Sem A", label: "Sem A 2026", active: true },
    projects: [
      {
        id: "p1",
        name: "Smart Campus API",
        type: "software",
        status: "ongoing",
        description: "Shared project resources and first meeting details.",
        leaderName: "Nguyễn Minh Anh",
        memberCount: 6,
        meetingUrl: "https://meet.example.edu/smart-campus-api",
        meetingLabel: null,
        bom: null,
        kickoffAt: "2026-10-12T09:00:00Z",
      },
      {
        id: "p2",
        name: "Open Bench",
        type: "hardware",
        status: "planning",
        description:
          "Prototype workspace and bill of materials for the bench-top test rig.",
        leaderName: "Trần Gia Huy",
        memberCount: 4,
        meetingUrl: null,
        meetingLabel: null,
        bom: null,
        kickoffAt: null,
      },
      {
        id: "p3",
        name: "Club Tools",
        type: "software",
        status: "completed",
        description: "Development brief and first meeting details.",
        leaderName: "Lê Thảo Vy",
        memberCount: 5,
        meetingUrl: "https://meet.example.edu/club-tools",
        meetingLabel: null,
        bom: null,
        kickoffAt: "2026-09-20T14:00:00Z",
      },
      {
        id: "p4",
        name: "Sensor Network",
        type: "hardware",
        status: "failed",
        description: "Low-power sensor mesh for the lab building.",
        leaderName: "Phạm Quốc Bảo",
        memberCount: 3,
        meetingUrl: null,
        meetingLabel: null,
        bom: null,
        kickoffAt: "2026-09-03T10:00:00Z",
      },
    ],
  };
}
