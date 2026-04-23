// Server-side load for workflow detail page.
// Fetches the workflow with node status, and builds per-node log URLs
// from the artifact-files endpoint using each node's main-logs artifact.
import { env } from '$env/dynamic/private';
import { createArgoClient } from '$lib/api/argo';
import { can } from '$lib/auth';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!can(locals.user?.role, 'workflows:view')) error(403, 'Forbidden');
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
					'metadata.name,metadata.uid,metadata.labels,status.phase,status.startedAt,status.finishedAt,status.message,status.nodes'
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
	// Archived workflows use UID in the artifact-files URL, active workflows use name
	const workflowKey = isArchived ? (data?.metadata?.uid ?? params.name) : params.name;

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
				const argoUrl = `${base}/artifact-files/${ns}/${workflowsPath}/${workflowKey}/${node.id}/outputs/${artifact.name}`;
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

	// Build SimScope connection parameters from the workflow
	const uid = data?.metadata?.uid ?? '';
	const simscopeNs = env.SIMSCOPE_NAMESPACE ?? ns;
	const simscopeHost = uid ? `rrs-server-service-${uid}.${simscopeNs}.svc.cluster.local` : '';
	const simscopePort = env.SIMSCOPE_PORT ?? '';
	const s3LogBucket = env.SIMSCOPE_LOG_BUCKET ?? '';
	function buildS3ObjectUrl(bucket: string, key: string): string {
		if (env.S3_ENDPOINT) {
			// MinIO / Ceph: path-style URL using the custom endpoint
			return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${bucket}/${key}`;
		}
		// AWS S3: virtual-hosted style
		const region = env.S3_REGION ?? 'us-east-1';
		return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
	}
	const simscopeUrl =
		s3LogBucket && uid ? buildS3ObjectUrl(s3LogBucket, `${uid}/rescue.log.7z`) : '';

	return {
		workflow: data!,
		namespace: ns,
		logUrlByNodeId,
		artifacts,
		simscopeBaseUrl: env.SIMSCOPE_BASE_URL ?? '',
		simscopeHost,
		simscopePort,
		simscopeUrl
	};
};
