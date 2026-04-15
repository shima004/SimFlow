// Authentication and authorization utilities.
// JWT verification uses HS256 (JWT_SECRET) or RS256 (JWT_PUBLIC_KEY).
import { jwtVerify, importSPKI } from 'jose';
import { env } from '$env/dynamic/private';

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

// Permissions granted to each role
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
		const publicKeyPem = env.JWT_PUBLIC_KEY;
		let key: CryptoKey | Uint8Array;

		if (publicKeyPem) {
			// RS256 / ES256 — asymmetric key provided as PEM
			key = await importSPKI(publicKeyPem, env.JWT_ALGORITHM ?? 'RS256');
		} else if (env.JWT_SECRET) {
			// HS256 — symmetric secret
			key = new TextEncoder().encode(env.JWT_SECRET);
		} else {
			console.error('[auth] JWT_SECRET or JWT_PUBLIC_KEY must be set');
			return null;
		}

		const { payload } = await jwtVerify(token, key);
		return (payload.sub as string) ?? null;
	} catch {
		return null;
	}
}
