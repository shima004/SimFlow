// Server-side load for workflow detail page.
// Fetches the workflow with node status, and builds per-node log URLs
// from the artifact-files endpoint using each node's main-logs artifact.
import { env } from '$env/dynamic/private';
import { createArgoClient } from '$lib/api/argo';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const baseUrl = env.ARGO_BASE_URL;

	if (!baseUrl) {
		error(500, 'ARGO_BASE_URL environment variable is required');
	}

	const client = createArgoClient(baseUrl, env.ARGO_TOKEN);

	const { data, error: apiError } = await client.GET('/api/v1/workflows/{namespace}/{name}', {
		params: {
			path: { namespace: params.namespace, name: params.name },
			query: {
				fields:
					'metadata.name,metadata.uid,status.phase,status.startedAt,status.finishedAt,status.message,status.nodes'
			}
		}
	});

	if (apiError) {
		error(502, `Failed to fetch workflow: ${JSON.stringify(apiError)}`);
	}

	// Build a map of nodeId → log artifact URL.
	// Only nodes with a main-logs artifact get an entry.
	// URL format: {base}/artifact-files/{ns}/archived-workflows/{wf}/{nodeId}/outputs/main-logs
	const base = baseUrl.replace(/\/$/, '');
	const ns = params.namespace;
	// Artifact URLs use the workflow UID, not the name
	const wf = data!.metadata!.uid!;

	const logUrlByNodeId: Record<string, string> = {};
	const nodes = data?.status?.nodes;
	if (nodes) {
		for (const node of Object.values(nodes)) {
			const hasMainLogs = node.outputs?.artifacts?.some((a) => a.name === 'main-logs');
			if (hasMainLogs) {
				logUrlByNodeId[node.id] =
					`${base}/artifact-files/${ns}/archived-workflows/${wf}/${node.id}/outputs/main-logs`;
			}
		}
	}

	return {
		workflow: data!,
		namespace: ns,
		logUrlByNodeId
	};
};
