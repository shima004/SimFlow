<script lang="ts">
	// Agent × Map score matrix.
	// Rows = agents (S3 keys), columns = maps (S3 keys).
	// Each cell shows the best score from matching Argo Workflow labels.
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const phaseVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
		Succeeded: 'default',
		Running: 'secondary',
		Failed: 'destructive',
		Error: 'destructive',
		Pending: 'outline'
	};

	// Selection state — all selected by default
	let selectedAgents = $state(new Set(data.agentKeys));
	let selectedMaps = $state(new Set(data.mapKeys));

	// Search queries for filtering the selector lists
	let agentSearch = $state('');
	let mapSearch = $state('');

	let filteredAgentKeys = $derived(
		data.agentKeys.filter((a) => a.toLowerCase().includes(agentSearch.toLowerCase()))
	);
	let filteredMapKeys = $derived(
		data.mapKeys.filter((m) => m.toLowerCase().includes(mapSearch.toLowerCase()))
	);

	let visibleAgents = $derived(data.agentKeys.filter((a) => selectedAgents.has(a)));
	let visibleMaps = $derived(data.mapKeys.filter((m) => selectedMaps.has(m)));

	function toggleAgent(key: string) {
		const next = new Set(selectedAgents);
		next.has(key) ? next.delete(key) : next.add(key);
		selectedAgents = next;
	}

	function toggleMap(key: string) {
		const next = new Set(selectedMaps);
		next.has(key) ? next.delete(key) : next.add(key);
		selectedMaps = next;
	}

	// Select/deselect only the currently filtered items
	function selectFilteredAgents() {
		const next = new Set(selectedAgents);
		filteredAgentKeys.forEach((k) => next.add(k));
		selectedAgents = next;
	}
	function clearFilteredAgents() {
		const next = new Set(selectedAgents);
		filteredAgentKeys.forEach((k) => next.delete(k));
		selectedAgents = next;
	}
	function selectFilteredMaps() {
		const next = new Set(selectedMaps);
		filteredMapKeys.forEach((k) => next.add(k));
		selectedMaps = next;
	}
	function clearFilteredMaps() {
		const next = new Set(selectedMaps);
		filteredMapKeys.forEach((k) => next.delete(k));
		selectedMaps = next;
	}

	function cellRun(agent: string, map: string) {
		return data.scoreMap[`${agent}::${map}`] ?? null;
	}

	function formatScore(score: string): string {
		const n = Number(score);
		return isNaN(n) ? score : n.toFixed(3);
	}
</script>

<main class="mx-auto max-w-full p-6">
	<div class="mb-6">
		<a href="/" class="text-muted-foreground hover:text-foreground mb-2 inline-block text-sm">
			← Back
		</a>
		<h1 class="text-2xl font-semibold">Score Matrix</h1>
		<p class="text-muted-foreground text-sm">
			{visibleAgents.length} / {data.agentKeys.length} agents ×
			{visibleMaps.length} / {data.mapKeys.length} maps
		</p>
	</div>

	{#if data.agentKeys.length === 0 || data.mapKeys.length === 0}
		<p class="text-muted-foreground text-sm">No agents or maps found in S3.</p>
	{:else}
		<div class="mb-6 flex flex-wrap gap-6">
			<!-- Agent selector -->
			<div class="w-64">
				<div class="mb-2 flex items-center gap-2">
					<span class="text-sm font-medium">Agents</span>
					<Button size="sm" variant="ghost" class="h-6 px-1 text-xs" onclick={selectFilteredAgents}>All</Button>
					<Button size="sm" variant="ghost" class="h-6 px-1 text-xs" onclick={clearFilteredAgents}>None</Button>
					<span class="text-muted-foreground ml-auto text-xs">{selectedAgents.size} selected</span>
				</div>
				<Input placeholder="Filter agents..." bind:value={agentSearch} class="mb-2 h-7 text-xs" />
				<div class="border-border max-h-48 overflow-y-auto rounded-md border">
					{#each filteredAgentKeys as agent}
						<label
							class="hover:bg-muted flex cursor-pointer items-center gap-2 px-2 py-1 text-xs"
							class:bg-muted={selectedAgents.has(agent)}
						>
							<input
								type="checkbox"
								checked={selectedAgents.has(agent)}
								onchange={() => toggleAgent(agent)}
								class="shrink-0"
							/>
							<span class="font-mono truncate" title={agent}>{agent}</span>
						</label>
					{:else}
						<p class="text-muted-foreground px-2 py-2 text-xs">No matches</p>
					{/each}
				</div>
				<!-- Selected chips -->
				{#if selectedAgents.size > 0}
					<div class="mt-2 flex flex-wrap gap-1">
						{#each visibleAgents as agent}
							<button
								class="bg-secondary text-secondary-foreground hover:bg-secondary/70 flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs"
								onclick={() => toggleAgent(agent)}
								title="Remove {agent}"
							>
								{agent} <span class="opacity-60">×</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Map selector -->
			<div class="w-64">
				<div class="mb-2 flex items-center gap-2">
					<span class="text-sm font-medium">Maps</span>
					<Button size="sm" variant="ghost" class="h-6 px-1 text-xs" onclick={selectFilteredMaps}>All</Button>
					<Button size="sm" variant="ghost" class="h-6 px-1 text-xs" onclick={clearFilteredMaps}>None</Button>
					<span class="text-muted-foreground ml-auto text-xs">{selectedMaps.size} selected</span>
				</div>
				<Input placeholder="Filter maps..." bind:value={mapSearch} class="mb-2 h-7 text-xs" />
				<div class="border-border max-h-48 overflow-y-auto rounded-md border">
					{#each filteredMapKeys as map}
						<label
							class="hover:bg-muted flex cursor-pointer items-center gap-2 px-2 py-1 text-xs"
							class:bg-muted={selectedMaps.has(map)}
						>
							<input
								type="checkbox"
								checked={selectedMaps.has(map)}
								onchange={() => toggleMap(map)}
								class="shrink-0"
							/>
							<span class="font-mono truncate" title={map}>{map}</span>
						</label>
					{:else}
						<p class="text-muted-foreground px-2 py-2 text-xs">No matches</p>
					{/each}
				</div>
				<!-- Selected chips -->
				{#if selectedMaps.size > 0}
					<div class="mt-2 flex flex-wrap gap-1">
						{#each visibleMaps as map}
							<button
								class="bg-secondary text-secondary-foreground hover:bg-secondary/70 flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs"
								onclick={() => toggleMap(map)}
								title="Remove {map}"
							>
								{map} <span class="opacity-60">×</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Matrix table -->
		{#if visibleAgents.length === 0 || visibleMaps.length === 0}
			<p class="text-muted-foreground text-sm">Select at least one agent and one map.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="border-collapse text-sm">
					<thead>
						<tr>
							<th class="bg-muted border px-3 py-2 text-left font-medium">Agent \ Map</th>
							{#each visibleMaps as map}
								<th class="bg-muted border px-3 py-2 font-mono text-xs font-medium">{map}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each visibleAgents as agent}
							<tr>
								<td class="bg-muted border px-3 py-2 font-mono text-xs font-medium">{agent}</td>
								{#each visibleMaps as map}
									{@const run = cellRun(agent, map)}
									<td class="border px-3 py-2 text-center align-middle">
										{#if !run}
											<span class="text-muted-foreground">—</span>
										{:else}
											<a
												href="/workflows/{data.namespace}/{run.workflowName}"
												class="inline-flex items-center gap-1 hover:underline"
												title={run.workflowName}
											>
												<Badge variant={phaseVariant[run.phase] ?? 'outline'} class="text-xs">
													{run.score !== '' ? formatScore(run.score) : run.phase}
												</Badge>
											</a>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</main>
