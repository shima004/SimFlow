// Client-safe permission helpers (no server-only imports).
// Mirrors the role-permission mapping in auth.ts.
export type Role = 'admin' | 'operator' | 'competition-upload' | 'competition' | 'viewer';

export type Permission =
	| 'workflows:list'
	| 'workflows:view'
	| 'workflows:run'
	| 'workflows:stop'
	| 'workflows:delete'
	| 'competitions:view'
	| 'competitions:manage'
	| 's3:view'
	| 's3:maps:view'
	| 's3:upload'
	| 's3:delete'
	| 'admin';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
	admin: [
		'workflows:list', 'workflows:view', 'workflows:run', 'workflows:stop', 'workflows:delete',
		'competitions:view', 'competitions:manage',
		's3:view', 's3:maps:view', 's3:upload', 's3:delete',
		'admin'
	],
	operator: [
		'workflows:list', 'workflows:view', 'workflows:run', 'workflows:stop', 'workflows:delete',
		'competitions:view', 'competitions:manage',
		's3:view', 's3:maps:view', 's3:upload', 's3:delete'
	],
	// competition-upload: no workflow list, agents bucket only (no maps access)
	'competition-upload': [
		'workflows:view',
		'competitions:view',
		's3:view', 's3:upload'
	],
	// competition: no workflow list, agents bucket only (no maps access)
	competition: [
		'workflows:view',
		'competitions:view',
		's3:view'
	],
	viewer: [
		'workflows:list', 'workflows:view',
		'competitions:view',
		's3:view', 's3:maps:view'
	]
};

export function can(role: string | null | undefined, permission: Permission): boolean {
	if (!role) return false;
	return (ROLE_PERMISSIONS[role as Role] ?? []).includes(permission);
}
