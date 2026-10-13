// Reads a department's shared library (GET /api/department-resources). Server-only: it goes
// through backendFetch, which attaches the signed-in user's session token.
import { backendFetch } from "@/shared/api/backend";
import type { DepartmentCode } from "@/config/departments";
import type { DepartmentResource } from "@/features/department-resources/models/department-resource";

/** DepartmentResource in backend/src/modules/department-resources/model/department-resource.model.ts. */
interface ResourceDto {
  id: string;
  department_code: DepartmentCode;
  category: string;
  title: string;
  description: string | null;
  source_type: "LINK" | "FILE";
  url: string | null;
  file: { original_filename: string; size_bytes: number } | null;
  updated_by_name: string | null;
  updated_at: string;
}

export function mapResource(dto: ResourceDto): DepartmentResource {
  return {
    id: dto.id,
    departmentCode: dto.department_code,
    category: dto.category,
    title: dto.title,
    description: dto.description,
    kind: dto.source_type === "FILE" ? "file" : "link",
    url: dto.url,
    filename: dto.file?.original_filename ?? null,
    sizeBytes: dto.file?.size_bytes ?? null,
    updatedByName: dto.updated_by_name,
    updatedAt: dto.updated_at,
  };
}

/** `department` is only needed by the super-admin; members and department admins get their own. */
export async function getDepartmentResources(
  department: DepartmentCode | null,
): Promise<DepartmentResource[]> {
  const query = department ? `?department=${department}` : "";
  const { resources } = await backendFetch<{ resources: ResourceDto[] }>(
    `/api/department-resources${query}`,
  );
  return resources.map(mapResource);
}
