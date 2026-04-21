// Authentication and authorization utilities.
// JWT verification uses HS256 (JWT_SECRET).
import { jwtVerify } from 'jose';
import { env } from '$env/dynamic/private';

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

// Permissions granted to each role
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

export function hasPermission(role: Role, permission: Permission): boolean {
	return ROLE_PERMISSIONS[role].includes(permission);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
	if (!role) return false;
	return hasPermission(role, permission);
}

// Verify a JWT and return the subject claim, or null if invalid.
export async function verifyJwt(token: string): Promise<string | null> {
	try {
		if (!env.JWT_SECRET) {
			console.error('[auth] JWT_SECRET must be set');
			return null;
		}
		const key = new TextEncoder().encode(env.JWT_SECRET);
		const { payload } = await jwtVerify(token, key);
		return (payload.sub as string) ?? null;
	} catch {
		return null;
	}
}
