// getMeetingEmails() returns mock data until auth is wired; swap in
// GET /api/admin/projects (meeting link, members) + GET /api/admin/campaigns
// (kick-off delivery counts) and map snake_case to MeetingEmailProject.
import type {
  Delivery,
  MeetingEmailProject,
  Recipient,
} from "@/features/meeting-emails/models/meeting-email";
import type { SemesterSummary } from "@/features/projects/models/project";

const person = (id: string, fullName: string, email: string): Recipient => ({
  id,
  fullName,
  email: `${email}@student.example.edu`,
});

const HUY = person("m2", "Trần Gia Huy", "gia.huy");
const BAO = person("m4", "Phạm Quốc Bảo", "quoc.bao");
const NAM = person("m6", "Bùi Hoàng Nam", "hoang.nam");
const DUY = person("m8", "Hoàng Đức Duy", "duc.duy");
const ANH = person("m1", "Nguyễn Minh Anh", "minh.anh");
const VY = person("m3", "Lê Thảo Vy", "thao.vy");
const LINH = person("m5", "Đặng Phương Linh", "phuong.linh");
const NGAN = person("m7", "Võ Kim Ngân", "kim.ngan");
const HA = person("m9", "Ngô Thanh Hà", "thanh.ha");
const DANG = person("m10", "Vũ Hải Đăng", "hai.dang");

const SENT_AT = "2026-09-29T03:15:00Z"; // 10:15 GMT+7

const delivered = (recipient: Recipient): Delivery => ({
  recipientId: recipient.id,
  state: "sent",
  attempts: 1,
  lastAttemptAt: SENT_AT,
  error: null,
});

const bounced = (recipient: Recipient, error: string): Delivery => ({
  recipientId: recipient.id,
  state: "failed",
  attempts: 3,
  lastAttemptAt: SENT_AT,
  error,
});

export async function getMeetingEmails(): Promise<{
  semester: SemesterSummary;
  projects: MeetingEmailProject[];
}> {
  return {
    semester: { id: "sem-a", name: "Sem A", label: "Sem A 2026", active: true },
    projects: [
      {
        id: "p2",
        name: "Open Bench",
        type: "hardware",
        meetingUrl: "https://meet.example.edu/open-bench",
        meetingLabel: null,
        recipients: [HUY, BAO, NAM, DUY],
        deliveries: [],
        lastSentAt: null,
      },
      {
        id: "p1",
        name: "Smart Campus API",
        type: "software",
        meetingUrl: "https://meet.example.edu/smart-campus",
        meetingLabel: null,
        recipients: [ANH, VY, LINH, NGAN, HA, DANG],
        deliveries: [
          delivered(ANH),
          delivered(VY),
          delivered(LINH),
          delivered(HA),
          bounced(NGAN, "Mailbox full (temporary)"),
          bounced(DANG, "Recipient address rejected"),
        ],
        lastSentAt: SENT_AT,
      },
      {
        id: "p3",
        name: "Club Tools",
        type: "software",
        meetingUrl: null,
        meetingLabel: null,
        recipients: [ANH, VY, LINH, NGAN, HA],
        deliveries: [],
        lastSentAt: null,
      },
    ],
  };
}
