<script lang="ts">
	import { enhance } from '$app/forms';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { invalidateAll } from '$app/navigation';
	import { can } from '$lib/permissions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const role = $derived(data.user?.role);

	const TEMPLATES = $derived(data.workflowTemplates ?? []);

	// Per-cell submitting state keyed by run id
	let submitting = $state(new Set<number>());

	const phaseClass = (phase: string) =>
		phase === 'Succeeded'
			? 'bg-green-500 text-white border-transparent hover:bg-green-500'
			: phase === 'Running'
				? 'bg-blue-500 text-white border-transparent hover:bg-blue-500'
				: '';

	const phaseVariant = (phase: string): 'default' | 'secondary' | 'destructive' | 'outline' =>
		phase === 'Succeeded'
			? 'default'
			: phase === 'Running'
				? 'secondary'
				: phase === 'Failed' || phase === 'Error'
					? 'destructive'
					: 'outline';

	function getRun(agent: string, map: string) {
		return data.runs.find((r) => r.agent === agent && r.map === map);
	}

	function getStatus(workflowName: string | null) {
		if (!workflowName) return null;
		return data.workflowStatus[workflowName] ?? null;
	}

	// Per-agent template selection (agent name → template), synced from DB
	let agentTemplate = $state<Record<string, string>>({});

	$effect(() => {
		const defaultTemplate = TEMPLATES[0]?.value ?? '';
		agentTemplate = Object.fromEntries(
			data.agents.map((a) => [a, data.agentTemplates[a] ?? defaultTemplate])
		);
	});

	// Shared resource settings applied to all runs
	// CPU: 2~16 cores in steps of 2 (expressed as millicores)
	const CPU_OPTIONS = Array.from({ length: 8 }, (_, i) => `${(i + 1) * 2000}m`);
	// Memory: 4Gi~32Gi in steps of 4
	const MEMORY_OPTIONS = Array.from({ length: 8 }, (_, i) => `${(i + 1) * 4}Gi`);
	let serverCpu = $state('4000m');
	let serverMemory = $state('8Gi');
	let agentCpu = $state('4000m');
	let agentMemory = $state('8Gi');

	// Sync resource settings from DB whenever data reloads
	$effect(() => {
		serverCpu = data.competition.server_cpu;
		serverMemory = data.competition.server_memory;
		agentCpu = data.competition.agent_cpu;
		agentMemory = data.competition.agent_memory;
	});
</script>

<main class="mx-auto max-w-7xl p-6">
	<div class="mb-4 flex items-start justify-between gap-4">
		<div>
			<button onclick={() => history.back()} class="text-muted-foreground hover:text-foreground mb-1 inline-block text-sm">
				← Competitions
			</button>
			<h1 class="text-2xl font-semibold">{data.competition.name}</h1>
			<p class="text-muted-foreground text-sm">
				{data.agents.length} agents × {data.maps.length} maps = {data.runs.length} runs
			</p>
		</div>
		<Button variant="outline" size="sm" onclick={() => invalidateAll()}>Refresh</Button>
	</div>

	<!-- Shared resource settings (manage only) -->
	{#if can(role, 'competitions:manage')}
		<form
			method="POST"
			action="?/updateResources"
			use:enhance={() => async ({ update }) => { await update(); }}
			class="bg-muted/40 mb-4 flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 text-sm"
		>
			<span class="font-medium">Resources</span>
			<label class="flex items-center gap-1.5">
				<span class="text-muted-foreground text-xs">Server CPU</span>
				<select name="server_cpu" bind:value={serverCpu} class="border-input bg-background h-7 rounded border px-2 text-xs">
					{#each CPU_OPTIONS as v}<option value={v}>{v}</option>{/each}
				</select>
			</label>
			<label class="flex items-center gap-1.5">
				<span class="text-muted-foreground text-xs">Server Memory</span>
				<select name="server_memory" bind:value={serverMemory} class="border-input bg-background h-7 rounded border px-2 text-xs">
					{#each MEMORY_OPTIONS as v}<option value={v}>{v}</option>{/each}
				</select>
			</label>
			<label class="flex items-center gap-1.5">
				<span class="text-muted-foreground text-xs">Agent CPU</span>
				<select name="agent_cpu" bind:value={agentCpu} class="border-input bg-background h-7 rounded border px-2 text-xs">
					{#each CPU_OPTIONS as v}<option value={v}>{v}</option>{/each}
				</select>
			</label>
			<label class="flex items-center gap-1.5">
				<span class="text-muted-foreground text-xs">Agent Memory</span>
				<select name="agent_memory" bind:value={agentMemory} class="border-input bg-background h-7 rounded border px-2 text-xs">
					{#each MEMORY_OPTIONS as v}<option value={v}>{v}</option>{/each}
				</select>
			</label>
			<Button type="submit" size="sm" variant="outline" class="h-7">Save</Button>
		</form>
	{/if}

	<!-- Ranking table -->
	{#if data.ranking.length > 0}
		<section class="mb-6">
			<h2 class="mb-2 text-base font-semibold">Ranking</h2>
			<div class="overflow-x-auto rounded-lg border">
				<table class="text-sm">
					<thead>
						<tr class="bg-muted border-b">
							<th class="px-3 py-2 text-right font-medium">#</th>
							<th class="px-3 py-2 text-left font-medium whitespace-nowrap">Agent</th>
							{#each data.maps as map}
								<th class="px-3 py-2 text-right font-medium font-mono whitespace-nowrap text-xs">{map}</th>
							{/each}
							<th class="px-3 py-2 text-right font-medium whitespace-nowrap">FTS</th>
						</tr>
					</thead>
					<tbody>
						{#each data.ranking as entry}
							<tr class="border-b last:border-0 {entry.rank === 1 ? 'bg-yellow-50 dark:bg-yellow-950/20' : entry.rank === 2 ? 'bg-gray-50 dark:bg-gray-900/20' : entry.rank === 3 ? 'bg-orange-50 dark:bg-orange-950/20' : ''}">
								<td class="px-3 py-2 text-right font-medium tabular-nums">
									{entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
								</td>
								<td class="px-3 py-2 font-mono whitespace-nowrap">{entry.agent}</td>
								{#each data.maps as map}
									{@const tp = entry.tpByMap[map] ?? 0}
									{@const hasScore = data.scores[entry.agent]?.[map] != null}
									<td class="px-3 py-2 text-right tabular-nums {hasScore ? '' : 'text-muted-foreground'}">
										{hasScore ? tp : '—'}
									</td>
								{/each}
								<td class="px-3 py-2 text-right font-semibold tabular-nums">{entry.fts}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<!-- Agent × Map matrix -->
	<div class="overflow-x-auto rounded-lg border">
		<table class="text-sm">
			<thead>
				<tr class="bg-muted border-b">
					<th class="px-3 py-2 text-left font-medium whitespace-nowrap">Agent \ Map</th>
					{#each data.maps as map}
						<th class="px-3 py-2 text-left font-medium whitespace-nowrap font-mono">{map}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data.agents as agent}
					<tr class="border-b last:border-0">
						<td class="px-3 py-2 font-mono font-medium whitespace-nowrap">
							<div class="flex flex-col gap-1">
								<span>{agent}</span>
								{#if can(role, 'competitions:manage')}
									<form method="POST" action="?/setAgentTemplate" use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}>
										<input type="hidden" name="agent" value={agent} />
										<div class="flex gap-1">
											{#each TEMPLATES as t}
												<button
													type="submit"
													name="template"
													value={t.value}
													class="rounded px-2 py-0.5 text-xs border transition-colors {agentTemplate[agent] === t.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}"
												>{t.label}</button>
											{/each}
										</div>
									</form>
								{:else}
									<span class="text-muted-foreground text-xs">{TEMPLATES.find((t) => t.value === agentTemplate[agent])?.label ?? agentTemplate[agent]}</span>
								{/if}
							</div>
						</td>
						{#each data.maps as map}
							{@const run = getRun(agent, map)}
							{@const status = getStatus(run?.workflow_name ?? null)}
							<td class="px-3 py-2 whitespace-nowrap min-w-[140px]">
								{#if status}
									<div class="flex flex-col gap-1">
										<Badge variant={phaseVariant(status.phase)} class={phaseClass(status.phase)}>
											{status.phase}
										</Badge>
										{#if status.score}
											<span class="text-xs font-mono">
												{isNaN(Number(status.score)) ? status.score : Number(status.score).toFixed(3)}
											</span>
										{/if}
										{#if run?.workflow_name}
											<a
												href="/workflows/{data.namespace}/{run.workflow_name}"
												class="text-xs text-blue-500 hover:underline font-mono truncate max-w-[160px] block"
											>
												{run.workflow_name}
											</a>
										{/if}
									</div>
								{/if}
								{#if run && can(role, 'competitions:manage')}
									<form
										method="POST"
										action="?/run"
										use:enhance={() => {
											submitting = new Set([...submitting, run.id]);
											return async ({ update }) => {
												await update();
												submitting = new Set([...submitting].filter((id) => id !== run.id));
												await invalidateAll();
											};
										}}
										class="mt-1 flex items-center gap-1"
									>
										<input type="hidden" name="run_id" value={run.id} />
										<input type="hidden" name="server_cpu" value={serverCpu} />
										<input type="hidden" name="server_memory" value={serverMemory} />
										<input type="hidden" name="agent_cpu" value={agentCpu} />
										<input type="hidden" name="agent_memory" value={agentMemory} />
										<Button
											type="submit"
											size="sm"
											variant={status ? 'outline' : 'default'}
											class="h-6 px-2 text-xs"
											disabled={submitting.has(run.id)}
										>
											{submitting.has(run.id) ? '...' : status ? 'Retry' : 'Run'}
										</Button>
									</form>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</main>
