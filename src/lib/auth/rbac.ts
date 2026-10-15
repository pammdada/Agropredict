// Permission matrix (section 3). Permissions are "resource:action" and are
// always checked on the server; the UI only hides what a role cannot do.

export type Role = "SUPERADMIN" | "ORG_ADMIN" | "ORG_ANALYST";

export const PERMISSIONS = [
  "dashboard:read",
  "farm:read",
  "farm:write",
  "farm:delete",
  "simulation:read",
  "simulation:run",
  "decision:read",
  "decision:write",
  "alert:read",
  "alert:write",
  "alert_rule:manage",
  "coldchain:read",
  "team:manage",
  "sso:manage",
  "billing:read",
  "billing:manage",
  "org:settings",
  "platform:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ_ONLY: Permission[] = [
  "dashboard:read",
  "farm:read",
  "simulation:read",
  "decision:read",
  "alert:read",
  "coldchain:read",
  "billing:read",
];

const ANALYST: Permission[] = [...READ_ONLY.filter((p) => p !== "billing:read"), "farm:write", "simulation:run", "decision:write", "alert:write"];

const ADMIN: Permission[] = [
  ...ANALYST,
  "farm:delete",
  "alert_rule:manage",
  "team:manage",
  "sso:manage",
  "billing:read",
  "billing:manage",
  "org:settings",
];

/** Effective role inside an organization. IMPERSONATOR = superadmin viewing an org read-only. */
export type OrgContextRole = "ORG_ADMIN" | "ORG_ANALYST" | "IMPERSONATOR";

const ORG_MATRIX: Record<OrgContextRole, ReadonlySet<Permission>> = {
  ORG_ADMIN: new Set(ADMIN),
  ORG_ANALYST: new Set(ANALYST),
  IMPERSONATOR: new Set(READ_ONLY),
};

export function can(role: OrgContextRole, permission: Permission): boolean {
  return ORG_MATRIX[role].has(permission);
}

export const ROLE_LABELS: Record<Role | "IMPERSONATOR", string> = {
  SUPERADMIN: "Superadmin",
  ORG_ADMIN: "Administrador",
  ORG_ANALYST: "Analista",
  IMPERSONATOR: "Superadmin (solo lectura)",
};
