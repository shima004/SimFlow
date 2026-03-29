<script lang="ts">
	// Agent × Map score matrix.
	// Rows = agents (S3 keys), columns = maps (S3 keys).
	// Each cell shows the best score from matching Argo Workflow labels.
	// Empty cells have a Run button that opens a confirmation dialog.
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
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

	// --- Run dialog state ---
	const LANGUAGES = [
		{ label: 'Python', template: 'rrs-workflow-python' },
		{ label: 'Java', template: 'rrs-workflow-java' }
	] as const;
	const CPU_OPTIONS = ['2000m', '3000m', '4000m'] as const;
	const MEMORY_OPTIONS = ['8Gi', '12Gi', '16Gi'] as const;

	let runDialogOpen = $state(false);
	let runAgent = $state('');
	let runMap = $state('');
	let runLanguage = $state<(typeof LANGUAGES)[number]>(LANGUAGES[0]);
	let runTag = $state('default');
	let runServerCpu = $state('3000m');
	let runServerMemory = $state('12Gi');
	let runAgentCpu = $state('3000m');
	let runAgentMemory = $state('12Gi');
	let runSubmitting = $state(false);
	let runError = $state('');
	let runSubmittedName = $state('');

	function openRunDialog(agent: string, map: string) {
		runAgent = agent;
		runMap = map;
		runError = '';
		runSubmittedName = '';
		runDialogOpen = true;
	}

	async function submitRun() {
		runSubmitting = true;
		runError = '';
		try {
			const res = await fetch('/api/workflow/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					template: runLanguage.template,
					agent: runAgent,
					map: runMap,
					tag: runTag || 'default',
					serverCpu: runServerCpu,
					serverMemory: runServerMemory,
					agentCpu: runAgentCpu,
					agentMemory: runAgentMemory
				})
			});
			if (!res.ok) throw new Error(await res.text());
			const { name } = await res.json();
			runSubmittedName = name;
			runDialogOpen = false;
		} catch (e) {
			runError = e instanceof Error ? e.message : String(e);
		} finally {
			runSubmitting = false;
		}
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
						<label class="hover:bg-muted flex cursor-pointer items-center gap-2 px-2 py-1 text-xs" class:bg-muted={selectedAgents.has(agent)}>
							<input type="checkbox" checked={selectedAgents.has(agent)} onchange={() => toggleAgent(agent)} class="shrink-0" />
							<span class="font-mono truncate" title={agent}>{agent}</span>
						</label>
					{:else}
						<p class="text-muted-foreground px-2 py-2 text-xs">No matches</p>
					{/each}
				</div>
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
						<label class="hover:bg-muted flex cursor-pointer items-center gap-2 px-2 py-1 text-xs" class:bg-muted={selectedMaps.has(map)}>
							<input type="checkbox" checked={selectedMaps.has(map)} onchange={() => toggleMap(map)} class="shrink-0" />
							<span class="font-mono truncate" title={map}>{map}</span>
						</label>
					{:else}
						<p class="text-muted-foreground px-2 py-2 text-xs">No matches</p>
					{/each}
				</div>
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
											<Button
												size="sm"
												variant="ghost"
												class="h-6 px-2 text-xs opacity-40 hover:opacity-100"
												onclick={() => openRunDialog(agent, map)}
											>
												▶ Run
											</Button>
										{:else}
											<div class="flex flex-col items-center gap-1">
												<a
													href="/workflows/{data.namespace}/{run.workflowName}"
													class="inline-flex items-center gap-1 hover:underline"
													title={run.workflowName}
												>
													<Badge variant={phaseVariant[run.phase] ?? 'outline'} class="text-xs">
														{run.score !== '' ? formatScore(run.score) : run.phase}
													</Badge>
												</a>
												{#if run.phase === 'Failed' || run.phase === 'Error'}
													<Button
														size="sm"
														variant="ghost"
														class="h-5 px-2 text-xs opacity-40 hover:opacity-100"
														onclick={() => openRunDialog(agent, map)}
													>
														▶ Retry
													</Button>
												{/if}
											</div>
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

<!-- Run confirmation dialog -->
<Dialog.Root bind:open={runDialogOpen}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Run Workflow</Dialog.Title>
			<Dialog.Description>
				<span class="font-mono">{runAgent}</span> × <span class="font-mono">{runMap}</span>
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-2">
			<!-- Language -->
			<div class="space-y-1">
				<p class="text-sm font-medium">Language</p>
				<div class="flex gap-2">
					{#each LANGUAGES as lang}
						<button
							class="rounded-md border px-4 py-1.5 text-sm transition-colors"
							class:bg-primary={runLanguage.template === lang.template}
							class:text-primary-foreground={runLanguage.template === lang.template}
							class:border-primary={runLanguage.template === lang.template}
							class:border-border={runLanguage.template !== lang.template}
							onclick={() => (runLanguage = lang)}
						>
							{lang.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Tag -->
			<div class="space-y-1">
				<label class="text-sm font-medium" for="matrix-run-tag">Tag</label>
				<Input id="matrix-run-tag" bind:value={runTag} placeholder="default" />
			</div>

			<!-- Resources -->
			<div class="space-y-2">
				<p class="text-sm font-medium">Resources</p>
				<div class="grid grid-cols-2 gap-x-4 gap-y-2">
					<div class="space-y-1">
						<label class="text-muted-foreground text-xs" for="matrix-server-cpu">Server CPU</label>
						<select id="matrix-server-cpu" bind:value={runServerCpu} class="border-input bg-background h-7 w-full rounded-md border px-2 text-xs">
							{#each CPU_OPTIONS as v}
								<option value={v}>{v.replace('000m', ' cores')}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1">
						<label class="text-muted-foreground text-xs" for="matrix-server-memory">Server Memory</label>
						<select id="matrix-server-memory" bind:value={runServerMemory} class="border-input bg-background h-7 w-full rounded-md border px-2 text-xs">
							{#each MEMORY_OPTIONS as v}
								<option value={v}>{v}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1">
						<label class="text-muted-foreground text-xs" for="matrix-agent-cpu">Agent CPU</label>
						<select id="matrix-agent-cpu" bind:value={runAgentCpu} class="border-input bg-background h-7 w-full rounded-md border px-2 text-xs">
							{#each CPU_OPTIONS as v}
								<option value={v}>{v.replace('000m', ' cores')}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1">
						<label class="text-muted-foreground text-xs" for="matrix-agent-memory">Agent Memory</label>
						<select id="matrix-agent-memory" bind:value={runAgentMemory} class="border-input bg-background h-7 w-full rounded-md border px-2 text-xs">
							{#each MEMORY_OPTIONS as v}
								<option value={v}>{v}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			{#if runError}
				<p class="text-destructive text-sm">{runError}</p>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (runDialogOpen = false)} disabled={runSubmitting}>Cancel</Button>
			<Button onclick={submitRun} disabled={runSubmitting}>
				{runSubmitting ? 'Submitting...' : 'Run'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
