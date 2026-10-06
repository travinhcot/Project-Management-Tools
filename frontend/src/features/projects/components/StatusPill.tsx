import { Pill, type PillTone } from "@/shared/components/Pill";
import {
  STATUS_LABELS,
  type ProjectStatus,
} from "@/features/projects/models/project";

const tones: Record<ProjectStatus, PillTone> = {
  planning: "neutral",
  ongoing: "success",
  completed: "done",
  failed: "danger",
};

export function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <Pill tone={tones[status]} size="sm">
      ● {STATUS_LABELS[status]}
    </Pill>
  );
}
