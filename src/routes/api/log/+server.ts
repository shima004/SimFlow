// SSE proxy for Argo Workflows log streaming.
// - Running: streams via Argo's NDJSON log API, converted to SSE.
// - Others: fetches completed logs from the artifact storage endpoint.
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const namespace = url.searchParams.get('namespace');
	const workflow = url.searchParams.get('workflow');
	const podName = url.searchParams.get('podName');
	const phase = url.searchParams.get('phase');
	const logUrl = url.searchParams.get('logUrl');

	if (!namespace || !workflow || !podName) {
		error(400, 'namespace, workflow, podName are required');
	}

	const baseUrl = env.ARGO_BASE_URL;
	if (!baseUrl) error(500, 'ARGO_BASE_URL is not set');

	const authHeader: Record<string, string> = {};
	if (env.ARGO_TOKEN) authHeader['Authorization'] = `Bearer ${env.ARGO_TOKEN}`;

	const encode = (s: string) => new TextEncoder().encode(s);

	if (phase === 'Running') {
		return streamFromApi({
			baseUrl, namespace, workflow, podName, encode,
			headers: { ...authHeader, Accept: 'application/json' }
		});
	} else {
		if (!logUrl) error(400, 'logUrl is required for non-running workflows');
		return streamFromArtifact({
			artifactUrl: logUrl,
			encode,
			headers: { ...authHeader, Accept: '*/*' }
		});
	}
};

// Stream live logs from Argo's NDJSON log API
async function streamFromApi(opts: {
	baseUrl: string;
	namespace: string;
	workflow: string;
	podName: string;
	headers: Record<string, string>;
	encode: (s: string) => Uint8Array;
}) {
	const { baseUrl, namespace, workflow, podName, headers, encode } = opts;

	const params = new URLSearchParams({
		podName,
		'logOptions.container': 'main',
		'logOptions.follow': 'true',
		'logOptions.timestamps': 'true'
	});
	const upstream = await fetch(
		`${baseUrl.replace(/\/$/, '')}/api/v1/workflows/${namespace}/${workflow}/log?${params}`,
		{ headers }
	);
	if (!upstream.ok || !upstream.body) {
		throw error(502, `Argo returned ${upstream.status}`);
	}

	const stream = new ReadableStream({
		async start(controller) {
			const reader = upstream.body!.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? '';
					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const content = JSON.parse(line).result?.content;
							if (content != null) {
								controller.enqueue(encode(`data: ${JSON.stringify(content)}\n\n`));
							}
						} catch { /* skip malformed */ }
					}
				}
			} finally {
				controller.enqueue(encode('event: done\ndata: \n\n'));
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }
	});
}

// Fetch completed logs from artifact storage, emit as SSE line by line
async function streamFromArtifact(opts: {
	artifactUrl: string;
	headers: Record<string, string>;
	encode: (s: string) => Uint8Array;
}) {
	const { artifactUrl, headers, encode } = opts;

	// Some Argo artifact servers require the token as a query param rather than a header
	const fetchUrl = env.ARGO_TOKEN
		? `${artifactUrl}?authorization=${encodeURIComponent(`Bearer ${env.ARGO_TOKEN}`)}`
		: artifactUrl;

	const upstream = await fetch(fetchUrl, { headers });
	if (!upstream.ok || !upstream.body) {
		const body = await upstream.text().catch(() => '');
		console.error('[artifact] fetch failed', upstream.status, artifactUrl, body);
		throw error(502, `Artifact fetch returned ${upstream.status}`);
	}

	const stream = new ReadableStream({
		async start(controller) {
			const reader = upstream.body!.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						// flush remaining buffer as last line
						if (buffer) {
							controller.enqueue(encode(`data: ${JSON.stringify(buffer)}\n\n`));
						}
						break;
					}
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? '';
					for (const line of lines) {
						controller.enqueue(encode(`data: ${JSON.stringify(line)}\n\n`));
					}
				}
			} finally {
				controller.enqueue(encode('event: done\ndata: \n\n'));
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }
	});
}
