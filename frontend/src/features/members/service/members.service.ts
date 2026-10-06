// getMembers() returns mock data until auth is wired; swap in
// GET /api/admin/semesters/:semesterId/roster (items[]) and map snake_case to Member.
import type { Member } from "@/features/members/models/member";
import type { SemesterSummary } from "@/features/projects/models/project";

type Seed = [name: string, email: string, department: Member["department"], year: number | null];

const SEED: Seed[] = [
  ["Nguyễn Minh Anh", "minh.anh@student.example.edu", "software", 2003],
  ["Trần Gia Huy", "gia.huy@student.example.edu", "hardware", 2002],
  ["Lê Thảo Vy", "thao.vy@student.example.edu", "software", 2004],
  ["Phạm Quốc Bảo", "quoc.bao@student.example.edu", "hardware", 2003],
  ["Đặng Phương Linh", "phuong.linh@student.example.edu", "software", 2001],
  ["Bùi Hoàng Nam", "hoang.nam@student.example.edu", "hardware", 2004],
  ["Võ Kim Ngân", "kim.ngan@student.example.edu", "software", null],
  ["Hoàng Đức Duy", "duc.duy@student.example.edu", "hardware", 2005],
  ["Ngô Thanh Hà", "thanh.ha@student.example.edu", "software", 2004],
];

export async function getMembers(): Promise<{
  semester: SemesterSummary;
  members: Member[];
}> {
  return {
    semester: { id: "sem-a", name: "Sem A", label: "Sem A 2026", active: true },
    members: SEED.map(([fullName, email, department, birthYear], index) => ({
      id: `m${index + 1}`,
      fullName,
      email,
      department,
      birthYear,
      status: "active",
      linked: true,
    })),
  };
}
