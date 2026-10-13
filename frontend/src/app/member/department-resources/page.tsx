import type { Metadata } from "next";
import { DEPARTMENT_LABELS } from "@/config/departments";
import { DepartmentResourcesPage } from "@/features/department-resources/components/DepartmentResourcesPage";
import type { DepartmentResource } from "@/features/department-resources/models/department-resource";
import { getDepartmentResources } from "@/features/department-resources/service/department-resources.service";
import { NoAccessCard } from "@/features/member/components/NoAccessCard";
import { getMemberStatus } from "@/features/member/service/member.service";
import { ApiError } from "@/shared/api/errors";

export const metadata: Metadata = { title: "Department resources" };

export default async function Page() {
  const status = await getMemberStatus();
  if (!status.eligible) return <NoAccessCard email={status.email} />;

  // A member's library is their roster department's; the backend decides which that is.
  let resources: DepartmentResource[];
  try {
    resources = await getDepartmentResources(null);
  } catch (error) {
    // A roster entry without a department has no library (the backend answers 403).
    if (error instanceof ApiError && error.status === 403) return <NoAccessCard email={status.email} />;
    throw error;
  }

  const code = resources[0]?.departmentCode ?? null;
  return (
    <DepartmentResourcesPage
      resources={resources}
      department={null}
      departmentLabel={code ? DEPARTMENT_LABELS[code] : "Your department"}
      switchable={false}
      audience="member"
    />
  );
}
