// Server load and actions for competition detail page.
// Shows agent×map matrix with run status, and allows submitting workflows per cell.
import { getDb } from '$lib/db';
import { createArgoClient } from '$lib/api/argo';
import { env } from '$env/dynamic/private';
import { error, fail } from '@sveltejs/kit';
import { can } from '$lib/auth';
import type { Actions, PageServerLoad } from './$types';
import type { Competition, CompetitionRun } from '$lib/db';

const ALLOWED_TEMPLATES = ['rrs-workflow-python', 'rrs-workflow-java'] as const;

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!can(locals.user?.role, 'competitions:view')) error(403, 'Forbidden');
	const db = getDb();
	const id = Number(params.id);

	const competition = db
		.prepare('SELECT * FROM competitions WHERE id = ?')
		.get(id) as Competition | undefined;
	if (!competition) error(404, 'Competition not found');

	const runs = db
		.prepare('SELECT * FROM competition_runs WHERE competition_id = ? ORDER BY agent, map')
		.all(id) as CompetitionRun[];

	// Fetch latest workflow status for linked runs
	const linkedRuns = runs.filter((r) => r.workflow_name);
	let workflowStatus: Record<string, { phase: string; score: string | null }> = {};

	if (linkedRuns.length > 0 && env.ARGO_BASE_URL) {
		const client = createArgoClient(env.ARGO_BASE_URL, env.ARGO_TOKEN);
		const namespace = env.ARGO_NAMESPACE ?? 'argo';
		await Promise.all(
			linkedRuns.map(async (run) => {
				if (!run.workflow_name) return;
				const { data } = await client.GET('/api/v1/workflows/{namespace}/{name}', {
					params: {
						path: { namespace, name: run.workflow_name },
						query: { fields: 'status.phase,metadata.labels' }
					}
				});
				if (data) {
					workflowStatus[run.workflow_name] = {
						phase: data.status?.phase ?? 'Unknown',
						score: data.metadata?.labels?.['score'] ?? null
					};
				}
			})
		);
	}

	// Derive unique agents and maps for matrix
	const agents = [...new Set(runs.map((r) => r.agent))].sort();
	const maps = [...new Set(runs.map((r) => r.map))].sort();

	// Build per-agent template map (all runs for an agent share the same template)
	const agentTemplates: Record<string, string> = {};
	for (const run of runs) {
		agentTemplates[run.agent] = run.template;
	}

	return { competition, runs, agents, maps, workflowStatus, agentTemplates, namespace: env.ARGO_NAMESPACE ?? 'argo' };
};

export const actions: Actions = {
	updateResources: async ({ request, params, locals }) => {
		if (!can(locals.user?.role, 'competitions:manage')) return fail(403, { error: 'Forbidden' });
		const db = getDb();
		const id = Number(params.id);
		const form = await request.formData();
		const serverCpu = (form.get('server_cpu') as string) || '4000m';
		const serverMemory = (form.get('server_memory') as string) || '8Gi';
		const agentCpu = (form.get('agent_cpu') as string) || '4000m';
		const agentMemory = (form.get('agent_memory') as string) || '8Gi';
		db.prepare(
			'UPDATE competitions SET server_cpu=?, server_memory=?, agent_cpu=?, agent_memory=? WHERE id=?'
		).run(serverCpu, serverMemory, agentCpu, agentMemory, id);
		return { success: true };
	},

	setAgentTemplate: async ({ request, params, locals }) => {
		if (!can(locals.user?.role, 'competitions:manage')) return fail(403, { error: 'Forbidden' });
		const db = getDb();
		const competitionId = Number(params.id);
		const form = await request.formData();
		const agent = form.get('agent') as string;
		const template = form.get('template') as string;
		if (!agent) return fail(400, { error: 'agent is required' });
		if (!(ALLOWED_TEMPLATES as readonly string[]).includes(template)) {
			return fail(400, { error: 'Invalid template' });
		}
		db.prepare(
			'UPDATE competition_runs SET template = ? WHERE competition_id = ? AND agent = ?'
		).run(template, competitionId, agent);
		return { success: true };
	},

	run: async ({ request, params, locals }) => {
		if (!can(locals.user?.role, 'competitions:manage')) return fail(403, { error: 'Forbidden' });
		const db = getDb();
		const competitionId = Number(params.id);
		const form = await request.formData();
		const runId = Number(form.get('run_id'));
		const serverCpu = (form.get('server_cpu') as string) || undefined;
		const serverMemory = (form.get('server_memory') as string) || undefined;
		const agentCpu = (form.get('agent_cpu') as string) || undefined;
		const agentMemory = (form.get('agent_memory') as string) || undefined;

		if (!runId) return fail(400, { error: 'run_id is required' });
		const run = db
			.prepare('SELECT * FROM competition_runs WHERE id = ? AND competition_id = ?')
			.get(runId, competitionId) as CompetitionRun | undefined;
		if (!run) return fail(404, { error: 'Run not found' });

		// Use the per-agent template stored in the run record
		const template = run.template;
		const baseUrl = env.ARGO_BASE_URL;
		const namespace = env.ARGO_NAMESPACE;
		if (!baseUrl || !namespace) return fail(500, { error: 'Argo not configured' });

		const client = createArgoClient(baseUrl, env.ARGO_TOKEN);
		const parameters = [`agent=${run.agent}`, `map=${run.map}`];
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
					labels: `agent=${run.agent},map=${run.map}`
				}
			}
		});

		if (apiError) return fail(502, { error: `Failed to submit: ${JSON.stringify(apiError)}` });

		const workflowName = data?.metadata?.name ?? null;
		const workflowUid = data?.metadata?.uid ?? null;
		db.prepare('UPDATE competition_runs SET workflow_name = ?, workflow_uid = ? WHERE id = ?')
			.run(workflowName, workflowUid, runId);

		return { success: true, workflowName };
	}
};
