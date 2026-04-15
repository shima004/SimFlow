// Client-safe permission helpers (no server-only imports).
// Mirrors the role-permission mapping in auth.ts.
export type Role = 'admin' | 'operator' | 'competition-upload' | 'competition' | 'viewer';

export type Permission =
	| 'workflows:view'
	| 'workflows:run'
	| 'workflows:stop'
	| 'workflows:delete'
	| 'competitions:view'
	| 'competitions:manage'
	| 's3:view'
	| 's3:upload'
	| 's3:delete'
	| 'admin';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
	admin: [
		'workflows:view', 'workflows:run', 'workflows:stop', 'workflows:delete',
		'competitions:view', 'competitions:manage',
		's3:view', 's3:upload', 's3:delete',
		'admin'
	],
	operator: [
		'workflows:view', 'workflows:run', 'workflows:stop', 'workflows:delete',
		'competitions:view', 'competitions:manage',
		's3:view', 's3:upload', 's3:delete'
	],
	'competition-upload': [
		'workflows:view',
		'competitions:view',
		's3:view', 's3:upload'
	],
	competition: [
		'workflows:view',
		'competitions:view',
		's3:view'
	],
	viewer: [
		'workflows:view',
		'competitions:view',
		's3:view'
	]
};

export function can(role: string | null | undefined, permission: Permission): boolean {
	if (!role) return false;
	return (ROLE_PERMISSIONS[role as Role] ?? []).includes(permission);
}
