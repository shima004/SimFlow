// Argo Workflows API client using openapi-fetch with generated schema types.
import createClient from 'openapi-fetch';
import type { paths } from './schema.d.ts';

export function createArgoClient(baseUrl: string, token?: string) {
	return createClient<paths>({
		baseUrl,
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	});
}
