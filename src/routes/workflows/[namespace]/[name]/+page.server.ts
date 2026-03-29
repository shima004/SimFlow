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
					'metadata.name,metadata.labels,status.phase,status.startedAt,status.finishedAt,status.message,status.nodes'
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
	// Use archived-workflows path when the workflow has been persisted to the archive
	const isArchived =
		data?.metadata?.labels?.['workflows.argoproj.io/workflow-archiving-status'] === 'Persisted';
	const workflowsPath = isArchived ? 'archived-workflows' : 'workflows';

	const logUrlByNodeId: Record<string, string> = {};
	type ArtifactEntry = {
		nodeId: string;
		nodeDisplayName: string;
		name: string;
		// Argo artifact-files URL — used only for log streaming (main-logs)
		argoUrl: string;
		// S3 key and bucket for direct presigned URL download
		s3Key: string;
		s3Bucket: string;
		filename: string;
	};
	const artifacts: ArtifactEntry[] = [];

	const nodes = data?.status?.nodes;
	if (nodes) {
		for (const node of Object.values(nodes)) {
			for (const artifact of node.outputs?.artifacts ?? []) {
				if (!artifact.name || !artifact.s3) continue;
				const argoUrl = `${base}/artifact-files/${ns}/${workflowsPath}/${params.name}/${node.id}/outputs/${artifact.name}`;
				const s3Key = artifact.s3.key ?? '';
				// Bucket may be specified per-artifact or fall back to env default
				const s3Bucket = artifact.s3.bucket ?? env.S3_ALLOWED_BUCKETS?.split(',')[0]?.trim() ?? '';
				const filename = s3Key.split('/').pop() ?? artifact.name;
				if (artifact.name === 'main-logs') {
					logUrlByNodeId[node.id] = argoUrl;
				}
				artifacts.push({
					nodeId: node.id,
					nodeDisplayName: node.displayName ?? node.id,
					name: artifact.name,
					argoUrl,
					s3Key,
					s3Bucket,
					filename
				});
			}
		}
	}

	return {
		workflow: data!,
		namespace: ns,
		logUrlByNodeId,
		artifacts
	};
};
