// SSE proxy for Argo Workflows log streaming.
// Converts Argo's NDJSON stream into Server-Sent Events so the browser
// can display log lines in real time via EventSource.
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const namespace = url.searchParams.get('namespace');
	const workflow = url.searchParams.get('workflow');
	const podName = url.searchParams.get('podName');

	if (!namespace || !workflow || !podName) {
		error(400, 'namespace, workflow, podName are required');
	}

	const baseUrl = env.ARGO_BASE_URL;
	if (!baseUrl) error(500, 'ARGO_BASE_URL is not set');

	const params = new URLSearchParams({
		podName,
		'logOptions.container': 'main',
		'logOptions.follow': 'true',
		'logOptions.timestamps': 'true'
	});
	const argoUrl = `${baseUrl}/api/v1/workflows/${namespace}/${workflow}/log?${params}`;

	const headers: Record<string, string> = { Accept: 'application/json' };
	if (env.ARGO_TOKEN) headers['Authorization'] = `Bearer ${env.ARGO_TOKEN}`;

	const upstream = await fetch(argoUrl, { headers });
	if (!upstream.ok || !upstream.body) {
		error(502, `Argo returned ${upstream.status}`);
	}

	// Convert NDJSON stream to SSE
	const stream = new ReadableStream({
		async start(controller) {
			const encode = (s: string) => new TextEncoder().encode(s);
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
							const json = JSON.parse(line);
							const content = json.result?.content;
							if (content != null) {
								controller.enqueue(encode(`data: ${JSON.stringify(content)}\n\n`));
							}
						} catch {
							// skip malformed lines
						}
					}
				}
			} finally {
				controller.enqueue(encode('event: done\ndata: \n\n'));
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
