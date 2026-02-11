/**
 * Team Role Permissions System
 *
 * Defines role-based access control (RBAC) for team members.
 * Supports both role-level permissions and granular overrides via the
 * teamMembers.permissions JSONB field.
 */

export type TeamRole = 'owner' | 'admin' | 'recruiter' | 'interviewer' | 'viewer'

export const TEAM_ROLES: TeamRole[] = ['owner', 'admin', 'recruiter', 'interviewer', 'viewer']

/**
 * Role hierarchy — lower index = higher authority.
 * Used for comparing role levels (e.g., owner > admin > recruiter).
 */
export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 0,
  admin: 1,
  recruiter: 2,
  interviewer: 3,
  viewer: 4,
}

/**
 * Permission sets for each role.
 * 'owner' uses the wildcard '*' to match any permission.
 */
export const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: ['*'],
  admin: [
    'team.manage',
    'team.view',
    'jobs.manage',
    'jobs.view',
    'candidates.manage',
    'candidates.view',
    'interviews.manage',
    'interviews.view',
    'interviews.feedback',
    'campaigns.manage',
    'settings.manage',
  ],
  recruiter: [
    'jobs.manage',
    'jobs.view',
    'candidates.manage',
    'candidates.view',
    'interviews.manage',
    'interviews.view',
    'interviews.feedback',
    'campaigns.manage',
  ],
  interviewer: [
    'interviews.view',
    'interviews.feedback',
    'candidates.view',
  ],
  viewer: [
    'jobs.view',
    'candidates.view',
    'interviews.view',
  ],
}

/**
 * Check whether a given role has a specific permission.
 *
 * @param role - The team member's role
 * @param permission - The permission string to check (e.g. 'team.manage')
 * @param overrides - Optional JSONB permission overrides from the teamMembers record
 * @returns true if the role (or overrides) grants the permission
 */
export function hasPermission(
  role: TeamRole,
  permission: string,
  overrides?: Record<string, boolean> | null
): boolean {
  // Check granular overrides first — they take precedence
  if (overrides && typeof overrides === 'object') {
    if (permission in overrides) {
      return overrides[permission] === true
    }
  }

  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) {
    return false
  }

  // Wildcard grants everything
  if (permissions.includes('*')) {
    return true
  }

  return permissions.includes(permission)
}

/**
 * Compare two roles to see if `role` is at least as high as `minimumRole`.
 *
 * @param role - The team member's current role
 * @param minimumRole - The minimum role required
 * @returns true if role >= minimumRole in the hierarchy
 */
export function isRoleAtLeast(role: TeamRole, minimumRole: TeamRole): boolean {
  return ROLE_HIERARCHY[role] <= ROLE_HIERARCHY[minimumRole]
}

/**
 * Validate that a string is a valid TeamRole.
 */
export function isValidRole(role: string): role is TeamRole {
  return TEAM_ROLES.includes(role as TeamRole)
}
