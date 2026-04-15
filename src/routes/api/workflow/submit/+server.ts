// Submits a workflow from a WorkflowTemplate with agent and map parameters.
// POST /api/workflow/submit
// Body: { template: 'rrs-workflow-python' | 'rrs-workflow-java'; agent: string; map: string; tag?: string }
import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { can } from '$lib/auth';
import { createArgoClient } from '$lib/api/argo';
import type { RequestHandler } from './$types';

const ALLOWED_TEMPLATES = ['rrs-workflow-python', 'rrs-workflow-java'] as const;
type Template = (typeof ALLOWED_TEMPLATES)[number];

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!can(locals.user?.role, 'workflows:run')) error(403, 'Forbidden');

	const baseUrl = env.ARGO_BASE_URL;
	const namespace = env.ARGO_NAMESPACE;

	if (!baseUrl || !namespace) {
		error(500, 'ARGO_BASE_URL and ARGO_NAMESPACE are required');
	}

	let body: {
		template: Template;
		agent: string;
		map: string;
		tag?: string;
		serverCpu?: string;
		serverMemory?: string;
		agentCpu?: string;
		agentMemory?: string;
	};
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}

	const { template, agent, map, tag, serverCpu, serverMemory, agentCpu, agentMemory } = body;
	if (!template || !agent || !map) error(400, 'template, agent, and map are required');
	if (!(ALLOWED_TEMPLATES as readonly string[]).includes(template)) {
		error(400, `template must be one of: ${ALLOWED_TEMPLATES.join(', ')}`);
	}

	const client = createArgoClient(baseUrl, env.ARGO_TOKEN);

	const parameters = [`agent=${agent}`, `map=${map}`];
	if (tag) parameters.push(`tag=${tag}`);
	if (serverCpu) parameters.push(`server_cpu=${serverCpu}`);
	if (serverMemory) parameters.push(`server_memory=${serverMemory}`);
	if (agentCpu) parameters.push(`agent_cpu=${agentCpu}`);
	if (agentMemory) parameters.push(`agent_memory=${agentMemory}`);

	const { data, error: apiError } = await client.POST('/api/v1/workflows/{namespace}/submit', {
		params: { path: { namespace } },
		body: {
			resourceKind: 'WorkflowTemplate',
			resourceName: template,
			submitOptions: {
				parameters,
				labels: `agent=${agent},map=${map}`
			}
		}
	});

	if (apiError) {
		error(502, `Failed to submit workflow: ${JSON.stringify(apiError)}`);
	}

	return json({ name: data?.metadata?.name });
};
