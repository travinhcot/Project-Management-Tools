/** Application-owned profile. Credentials and sessions belong to Supabase Auth. */
export const USER_ROLES = ["ADMIN", "MEMBER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** PostgreSQL row shape; UUIDs and UTC timestamps are serialized strings. */
export interface AppUser {
  readonly id: string;
  readonly email: string;
  readonly normalized_email: string;
  readonly full_name: string;
  readonly role: UserRole;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Server-only provisioning input after verifying the Supabase identity. */
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
  readonly is_active: boolean;
  readonly last_sign_in_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AdminUserListQuery {
  readonly search?: string;
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
  readonly is_active?: boolean;
}
