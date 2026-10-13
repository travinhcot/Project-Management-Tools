/** Application-owned profile. Credentials and sessions belong to Supabase Auth. */
import { ACCOUNT_ROLES } from "../../../shared/roles.ts";

export const USER_ROLES = ACCOUNT_ROLES;
export const DEPARTMENT_CODES = ["TECH", "MARCOM", "HR"] as const;
export type DepartmentCode = (typeof DEPARTMENT_CODES)[number];
export type UserRole = (typeof USER_ROLES)[number];

/** PostgreSQL row shape; UUIDs and UTC timestamps are serialized strings. */
export interface AppUser {
  readonly id: string;
  readonly email: string;
  readonly normalized_email: string;
  readonly full_name: string;
  readonly role: UserRole;
  /** Null for ADMIN (every department); every other account has one. */
  readonly department_id: string | null;
  readonly department_code: DepartmentCode | null;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Server-only provisioning input after verifying the Supabase identity. A new member defaults to TECH. */
export interface CreateMemberProfile {
  readonly id: string;
  readonly email: string;
  readonly full_name: string;
}

/** Deliberately excludes identity, role and activation fields. */
export interface UpdateUserProfile {
  readonly full_name: string;
}

/** Only a trusted administrative service may accept these changes. */
export interface AdminUserView {
  readonly id: string;
  readonly email: string;
  readonly full_name: string;
  readonly role: UserRole;
  readonly department_code: DepartmentCode | null;
  readonly is_active: boolean;
  readonly last_sign_in_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AdminUserListQuery {
  readonly search?: string;
  readonly department?: DepartmentCode;
  readonly role?: UserRole;
  readonly is_active?: boolean;
  readonly page: number;
  readonly size: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly total: number;
}

export interface AdminUserAccessUpdate {
  readonly role?: UserRole;
  /** Not allowed with role ADMIN. Otherwise the new department; omitted keeps the current one. */
  readonly department_code?: DepartmentCode;
  readonly is_active?: boolean;
}
