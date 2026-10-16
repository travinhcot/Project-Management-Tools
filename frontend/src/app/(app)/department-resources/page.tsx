import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ACTIVE_DEPARTMENTS, DEPARTMENT_LABELS, type DepartmentCode } from "@/config/departments";
import { DepartmentResourcesPage } from "@/features/department-resources/components/DepartmentResourcesPage";
import { getDepartmentResources } from "@/features/department-resources/service/department-resources.service";
import { getViewer } from "@/shared/auth/viewer";

export const metadata: Metadata = { title: "Department resources" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ department?: string | string[] }>;
}) {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);
  // Department resources belong to Marcom; everyone else is sent back to the overview.
  if (viewer.role !== "DEPT_ADMIN" || viewer.departmentCode !== "MARCOM") redirect("/overview");
  const asked = Array.isArray(params.department) ? params.department[0] : params.department;
  // A department admin always works in their own department; the super-admin picks one.
  const department: DepartmentCode =
    viewer.role === "DEPT_ADMIN" && viewer.departmentCode
      ? viewer.departmentCode
      : ACTIVE_DEPARTMENTS.includes(asked as DepartmentCode)
        ? (asked as DepartmentCode)
        : ACTIVE_DEPARTMENTS[ACTIVE_DEPARTMENTS.length - 1];
  const resources = await getDepartmentResources(department);
  return (
    <DepartmentResourcesPage
      resources={resources}
      department={department}
      departmentLabel={DEPARTMENT_LABELS[department]}
      switchable={viewer.role === "ADMIN"}
      audience="admin"
    />
  );
}
