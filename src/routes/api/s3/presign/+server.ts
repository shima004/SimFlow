// Issues presigned URLs for download (GET) or upload (PUT).
// GET /api/s3/presign?key=<key>&bucket=<bucket>&operation=get|put&expiresIn=<seconds>
import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, assertBucketAllowed } from '$lib/s3';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const key = url.searchParams.get('key');
	if (!key) error(400, 'key is required');

	const bucket = url.searchParams.get('bucket');
	if (!bucket) error(400, 'bucket is required');

	try {
		assertBucketAllowed(bucket);
	} catch (e) {
		error(403, e instanceof Error ? e.message : String(e));
	}

	const operation = url.searchParams.get('operation') ?? 'get';
	const expiresIn = Number(url.searchParams.get('expiresIn') ?? '3600');

	if (!['get', 'put'].includes(operation)) {
		error(400, 'operation must be "get" or "put"');
	}

	// Upload requires higher privilege than download
	const requiredPermission = operation === 'put' ? 's3:upload' : 's3:view';
	if (!can(locals.user?.role, requiredPermission)) error(403, 'Forbidden');

	try {
		const client = getS3Client();
		const command =
			operation === 'put'
				? new PutObjectCommand({ Bucket: bucket, Key: key })
				: new GetObjectCommand({ Bucket: bucket, Key: key });

		const presignedUrl = await getSignedUrl(client, command, { expiresIn });
		return json({ url: presignedUrl, expiresIn });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		error(500, `S3 presign failed: ${msg}`);
	}
};
