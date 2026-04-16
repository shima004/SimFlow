// Deletes one or more objects from a bucket.
// DELETE /api/s3/delete
// Body: { bucket: string; keys: string[] }
import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getS3Client, assertBucketAllowed, getMapsBucket } from '$lib/s3';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!can(locals.user?.role, 's3:delete')) error(403, 'Forbidden');

	let body: { bucket: string; keys: string[] };
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { keys, bucket } = body;
	if (!bucket) error(400, 'bucket is required');
	if (!Array.isArray(keys) || keys.length === 0) {
		error(400, 'keys must be a non-empty array');
	}

	// Block competition roles from the maps bucket
	if (bucket === getMapsBucket() && !can(locals.user?.role, 's3:maps:view')) error(403, 'Forbidden');

	try {
		assertBucketAllowed(bucket);
	} catch (e) {
		error(403, e instanceof Error ? e.message : String(e));
	}

	try {
		const client = getS3Client();
		const res = await client.send(
			new DeleteObjectsCommand({
				Bucket: bucket,
				Delete: {
					Objects: keys.map((k) => ({ Key: k })),
					Quiet: false
				}
			})
		);

		return json({
			deleted: (res.Deleted ?? []).map((d) => d.Key),
			errors: (res.Errors ?? []).map((e) => ({ key: e.Key, message: e.Message }))
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		error(500, `S3 delete failed: ${msg}`);
	}
};
