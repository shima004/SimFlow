// Issues presigned URLs for download (GET) or upload (PUT).
// GET /api/s3/presign?key=<key>&bucket=<bucket>&operation=get|put&expiresIn=<seconds>
// competition/competition-upload roles are restricted to their own zip in the agents bucket:
//   - upload key is forced to {subject}.zip regardless of the requested key
//   - download is only allowed for {subject}.zip
import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, assertBucketAllowed } from '$lib/s3';
import type { RequestHandler } from './$types';

const COMPETITION_ROLES = ['competition', 'competition-upload'];

export const GET: RequestHandler = async ({ url, locals }) => {
	const requestedKey = url.searchParams.get('key');
	if (!requestedKey) error(400, 'key is required');

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

	const isCompetitionRole = COMPETITION_ROLES.includes(locals.user?.role ?? '');
	const ownKey = `${locals.user?.subject}.zip`;

	// Determine the effective S3 key
	let effectiveKey = requestedKey;
	if (isCompetitionRole && bucket === 'agents') {
		if (operation === 'put') {
			// Always write to the user's own key, ignoring the requested key
			effectiveKey = ownKey;
		} else {
			// Only allow reading the user's own file
			if (requestedKey !== ownKey) error(403, 'Forbidden');
		}
	}

	try {
		const client = getS3Client();
		const command =
			operation === 'put'
				? new PutObjectCommand({ Bucket: bucket, Key: effectiveKey })
				: new GetObjectCommand({ Bucket: bucket, Key: effectiveKey });

		const presignedUrl = await getSignedUrl(client, command, { expiresIn });
		// Return the effective key so the client knows the actual stored name
		return json({ url: presignedUrl, expiresIn, key: effectiveKey });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		error(500, `S3 presign failed: ${msg}`);
	}
};
