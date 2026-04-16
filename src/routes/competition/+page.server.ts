// Server load and actions for competition list page.
// Handles listing all competitions and creating a new one.
import { getDb } from '$lib/db';
import { listBucketKeys, getAgentsBucket, getMapsBucket } from '$lib/s3';
import { can } from '$lib/auth';
import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!can(locals.user?.role, 'competitions:view')) error(403, 'Forbidden');
	const db = getDb();
	const competitions = db.prepare('SELECT * FROM competitions ORDER BY created_at DESC').all() as import('$lib/db').Competition[];

	const [agentKeys, mapKeys] = await Promise.all([
		listBucketKeys(getAgentsBucket()).catch(() => [] as string[]),
		listBucketKeys(getMapsBucket()).catch(() => [] as string[])
	]);

	return {
		competitions,
		agentKeys,
		mapKeys
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!can(locals.user?.role, 'competitions:manage')) return fail(403, { error: 'Forbidden' });
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const agents = form.getAll('agents') as string[];
		const maps = form.getAll('maps') as string[];

		if (!name) return fail(400, { error: 'Name is required' });
		if (agents.length === 0) return fail(400, { error: 'Select at least one agent' });
		if (maps.length === 0) return fail(400, { error: 'Select at least one map' });

		const template = (form.get('template') as string) || 'rrs-workflow-python';
		const serverCpu = (form.get('server_cpu') as string) || '4000m';
		const serverMemory = (form.get('server_memory') as string) || '8Gi';
		const agentCpu = (form.get('agent_cpu') as string) || '4000m';
		const agentMemory = (form.get('agent_memory') as string) || '8Gi';

		const db = getDb();
		const insertComp = db.prepare(
			'INSERT INTO competitions (name, template, server_cpu, server_memory, agent_cpu, agent_memory) VALUES (?, ?, ?, ?, ?, ?)'
		);
		const insertRun = db.prepare(
			'INSERT INTO competition_runs (competition_id, agent, map) VALUES (?, ?, ?)'
		);

		const compId = db.transaction(() => {
			const result = insertComp.run(name, template, serverCpu, serverMemory, agentCpu, agentMemory);
			const id = result.lastInsertRowid as number;
			for (const agent of agents) {
				for (const map of maps) {
					insertRun.run(id, agent, map);
				}
			}
			return id;
		})();

		redirect(303, `/competition/${compId}`);
	}
};
