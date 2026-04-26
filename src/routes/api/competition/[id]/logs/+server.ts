// Streams a ZIP archive of run logs/artifacts for a competition.
// GET /api/competition/[id]/logs            — all Argo artifacts + rescue.log.7z
// GET /api/competition/[id]/logs?type=simscope — rescue.log.7z only (flat: {agent}_{map}.7z)
import { error } from '@sveltejs/kit';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { can } from '$lib/auth';
import { getDb } from '$lib/db';
import { getS3Client } from '$lib/s3';
import { createArgoClient } from '$lib/api/argo';
import { env } from '$env/dynamic/private';
import { Zip, ZipPassThrough } from 'fflate';
import type { RequestHandler } from './$types';
import type { CompetitionRun } from '$lib/db';

function sanitize(name: string): string {
	return name.replace(/[/\\:*?"<>|]/g, '_');
}

async function fetchS3Bytes(bucket: string, key: string): Promise<Uint8Array | null> {
	try {
		const client = getS3Client();
		const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
		if (!obj.Body) return null;
		return obj.Body.transformToByteArray();
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!can(locals.user?.role, 'admin')) error(403, 'Forbidden');

	const simscopeOnly = url.searchParams.get('type') === 'simscope';
	const db = getDb();
	const id = Number(params.id);

	const competition = db.prepare('SELECT * FROM competitions WHERE id = ?').get(id);
	if (!competition) error(404, 'Competition not found');

	const runs = db
		.prepare(
			'SELECT * FROM competition_runs WHERE competition_id = ? AND workflow_uid IS NOT NULL ORDER BY agent, map'
		)
		.all(id) as CompetitionRun[];

	if (runs.length === 0) error(404, 'No completed runs found');

	// Pre-fetch Argo artifact metadata for all runs
	type ArtifactInfo = { s3Key: string; s3Bucket: string; filename: string };
	type RunArtifacts = { run: CompetitionRun; artifacts: ArtifactInfo[]; simscopeKey: string | null; score: string | null };

	const baseUrl = env.ARGO_BASE_URL;
	const namespace = env.ARGO_NAMESPACE ?? 'argo';
	const logBucket = env.SIMSCOPE_LOG_BUCKET ?? '';
	const fallbackBucket = env.S3_ALLOWED_BUCKETS?.split(',')[0]?.trim() ?? '';

	const runArtifactsList: RunArtifacts[] = await Promise.all(
		runs.map(async (run) => {
			const artifacts: ArtifactInfo[] = [];
			let score: string | null = null;

			if (baseUrl && run.workflow_name) {
				const client = createArgoClient(baseUrl, env.ARGO_TOKEN);
				const fields = simscopeOnly
					? 'metadata.labels'
					: 'metadata.uid,metadata.labels,status.nodes';
				const { data } = await client.GET('/api/v1/workflows/{namespace}/{name}', {
					params: {
						path: { namespace, name: run.workflow_name },
						query: { fields }
					}
				});

				score = data?.metadata?.labels?.['score'] ?? null;

				if (!simscopeOnly) {
					for (const node of Object.values(data?.status?.nodes ?? {})) {
						for (const artifact of (node as any).outputs?.artifacts ?? []) {
							if (!artifact.s3?.key) continue;
							artifacts.push({
								s3Key: artifact.s3.key,
								s3Bucket: artifact.s3.bucket ?? fallbackBucket,
								filename: artifact.s3.key.split('/').pop() ?? artifact.name
							});
						}
					}
				}
			}

			const simscopeKey = logBucket && run.workflow_uid ? `${run.workflow_uid}/rescue.log.7z` : null;

			return { run, artifacts, simscopeKey, score };
		})
	);

	// Stream a ZIP archive
	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
	const writer = writable.getWriter();

	(async () => {
		try {
			await new Promise<void>((resolve, reject) => {
				const zip = new Zip((err, data, final) => {
					if (err) { reject(err); return; }
					writer.write(data);
					if (final) resolve();
				});

				(async () => {
					for (const { run, artifacts, simscopeKey, score } of runArtifactsList) {
						const base = `${sanitize(run.agent)}_${sanitize(run.map)}`;

						if (simscopeOnly) {
							// rescue.log.7z → {agent}_{map}.7z
							if (simscopeKey && logBucket) {
								const bytes = await fetchS3Bytes(logBucket, simscopeKey);
								if (bytes) {
									const entry = new ZipPassThrough(`${base}.7z`);
									zip.add(entry);
									entry.push(bytes, true);
								}
							}
							// score → {agent}_{map}_Score.txt
							if (score != null) {
								const txt = new TextEncoder().encode(score);
								const entry = new ZipPassThrough(`${base}_Score.txt`);
								zip.add(entry);
								entry.push(txt, true);
							}
						} else {
							// Folder per run: {agent}_{map}/{filename}
							for (const { s3Key, s3Bucket, filename } of artifacts) {
								const bytes = await fetchS3Bytes(s3Bucket, s3Key);
								if (!bytes) continue;
								const entry = new ZipPassThrough(`${base}/${filename}`);
								zip.add(entry);
								entry.push(bytes, true);
							}
							if (simscopeKey && logBucket) {
								const bytes = await fetchS3Bytes(logBucket, simscopeKey);
								if (bytes) {
									const entry = new ZipPassThrough(`${base}/rescue.log.7z`);
									zip.add(entry);
									entry.push(bytes, true);
								}
							}
						}
					}
					zip.end();
				})().catch(reject);
			});
		} catch {
			// ignore — client may have disconnected
		} finally {
			writer.close().catch(() => {});
		}
	})();

	const filename = simscopeOnly
		? `competition-${id}-simscope.zip`
		: `competition-${id}-logs.zip`;

	return new Response(readable as unknown as ReadableStream, {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
