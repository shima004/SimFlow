<script lang="ts">
	// Dialog for submitting workflow runs.
	// Supports multi-select for agents and maps; submits all (agent × map) combinations.
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	type Props = {
		open: boolean;
		onclose: () => void;
		onsubmitted: (names: string[]) => void;
		agentKeys: string[];
		mapKeys: string[];
	};

	let { open = $bindable(), onclose, onsubmitted, agentKeys, mapKeys }: Props = $props();

	const LANGUAGES = [
		{ label: 'Python', template: 'rrs-workflow-python' },
		{ label: 'Java', template: 'rrs-workflow-java' }
	] as const;
	type Language = (typeof LANGUAGES)[number];

	let language = $state<Language>(LANGUAGES[0]);
	let selectedAgents = $state(new Set<string>());
	let selectedMaps = $state(new Set<string>());
	let tag = $state('default');
	const CPU_OPTIONS = ['2000m', '3000m', '4000m'] as const;
	const MEMORY_OPTIONS = ['8Gi', '12Gi', '16Gi'] as const;

	let serverCpu = $state('3000m');
	let serverMemory = $state('12Gi');
	let agentCpu = $state('3000m');
	let agentMemory = $state('12Gi');
	let agentSearch = $state('');
	let mapSearch = $state('');
	let submitting = $state(false);
	let submitError = $state('');
	let submitResults = $state<{ combo: string; name?: string; error?: string }[]>([]);

	let filteredAgents = $derived(
		(agentKeys ?? []).filter((a) => a.toLowerCase().includes(agentSearch.toLowerCase()))
	);
	let filteredMaps = $derived(
		(mapKeys ?? []).filter((m) => m.toLowerCase().includes(mapSearch.toLowerCase()))
	);

	// Total number of combinations to submit
	let comboCount = $derived(selectedAgents.size * selectedMaps.size);

	$effect(() => {
		if (open) {
			selectedAgents = new Set();
			selectedMaps = new Set();
			submitError = '';
			submitResults = [];
			agentSearch = '';
			mapSearch = '';
		}
	});

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

	async function submit() {
		if (comboCount === 0) return;
		submitting = true;
		submitError = '';
		submitResults = [];

		// Build all (agent, map) pairs
		const combos: { agent: string; map: string }[] = [];
		for (const agent of selectedAgents) {
			for (const map of selectedMaps) {
				combos.push({ agent, map });
			}
		}

		// Submit all in parallel
		const results = await Promise.all(
			combos.map(async ({ agent, map }) => {
				try {
					const res = await fetch('/api/workflow/submit', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
						template: language.template,
						agent,
						map,
						tag: tag || 'default',
						serverCpu,
						serverMemory,
						agentCpu,
						agentMemory
					})
					});
					if (!res.ok) throw new Error(await res.text());
					const { name } = await res.json();
					return { combo: `${agent} × ${map}`, name };
				} catch (e) {
					return { combo: `${agent} × ${map}`, error: e instanceof Error ? e.message : String(e) };
				}
			})
		);

		submitResults = results;
		submitting = false;

		const succeeded = results.filter((r) => r.name).map((r) => r.name!);
		if (succeeded.length > 0) onsubmitted(succeeded);

		// Close only if all succeeded
		if (results.every((r) => r.name)) open = false;
	}
</script>

<Dialog.Root bind:open onOpenChange={(v) => { if (!v) onclose(); }}>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Run Workflow</Dialog.Title>
			<Dialog.Description>
				Select language, agents, and maps. All combinations will be submitted.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-2">
			<!-- Language toggle -->
			<div class="space-y-1">
				<p class="text-sm font-medium">Language</p>
				<div class="flex gap-2">
					{#each LANGUAGES as lang}
						<button
							class="rounded-md border px-4 py-1.5 text-sm transition-colors"
							class:bg-primary={language.template === lang.template}
							class:text-primary-foreground={language.template === lang.template}
							class:border-primary={language.template === lang.template}
							class:border-border={language.template !== lang.template}
							onclick={() => (language = lang)}
						>
							{lang.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Agent multi-select -->
			<div class="space-y-1">
				<p class="text-sm font-medium">
					Agents
					<span class="text-muted-foreground font-normal">({selectedAgents.size} selected)</span>
				</p>
				<Input placeholder="Filter..." bind:value={agentSearch} class="h-7 text-xs" />
				<div class="border-border max-h-40 overflow-y-auto rounded-md border">
					{#each filteredAgents as a}
						<label class="hover:bg-muted flex cursor-pointer items-center gap-2 px-2 py-1 text-xs {selectedAgents.has(a) ? 'bg-primary/10' : ''}">
							<input
								type="checkbox"
								checked={selectedAgents.has(a)}
								onchange={() => toggleAgent(a)}
								class="shrink-0"
							/>
							<span class="font-mono truncate" title={a}>{a}</span>
						</label>
					{:else}
						<p class="text-muted-foreground px-2 py-2 text-xs">No matches</p>
					{/each}
				</div>
			</div>

			<!-- Map multi-select -->
			<div class="space-y-1">
				<p class="text-sm font-medium">
					Maps
					<span class="text-muted-foreground font-normal">({selectedMaps.size} selected)</span>
				</p>
				<Input placeholder="Filter..." bind:value={mapSearch} class="h-7 text-xs" />
				<div class="border-border max-h-40 overflow-y-auto rounded-md border">
					{#each filteredMaps as m}
						<label class="hover:bg-muted flex cursor-pointer items-center gap-2 px-2 py-1 text-xs {selectedMaps.has(m) ? 'bg-primary/10' : ''}">
							<input
								type="checkbox"
								checked={selectedMaps.has(m)}
								onchange={() => toggleMap(m)}
								class="shrink-0"
							/>
							<span class="font-mono truncate" title={m}>{m}</span>
						</label>
					{:else}
						<p class="text-muted-foreground px-2 py-2 text-xs">No matches</p>
					{/each}
				</div>
			</div>

			<!-- Tag -->
			<div class="space-y-1">
				<label class="text-sm font-medium" for="run-tag">Tag</label>
				<Input id="run-tag" bind:value={tag} placeholder="default" />
			</div>

			<!-- Resource settings -->
			<div class="space-y-2">
				<p class="text-sm font-medium">Resources</p>
				<div class="grid grid-cols-2 gap-x-4 gap-y-2">
					<div class="space-y-1">
						<label class="text-muted-foreground text-xs" for="server-cpu">Server CPU</label>
						<select id="server-cpu" bind:value={serverCpu} class="border-input bg-background h-7 w-full rounded-md border px-2 text-xs">
							{#each CPU_OPTIONS as v}
								<option value={v}>{v.replace('000m', ' cores')}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1">
						<label class="text-muted-foreground text-xs" for="server-memory">Server Memory</label>
						<select id="server-memory" bind:value={serverMemory} class="border-input bg-background h-7 w-full rounded-md border px-2 text-xs">
							{#each MEMORY_OPTIONS as v}
								<option value={v}>{v}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1">
						<label class="text-muted-foreground text-xs" for="agent-cpu">Agent CPU</label>
						<select id="agent-cpu" bind:value={agentCpu} class="border-input bg-background h-7 w-full rounded-md border px-2 text-xs">
							{#each CPU_OPTIONS as v}
								<option value={v}>{v.replace('000m', ' cores')}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1">
						<label class="text-muted-foreground text-xs" for="agent-memory">Agent Memory</label>
						<select id="agent-memory" bind:value={agentMemory} class="border-input bg-background h-7 w-full rounded-md border px-2 text-xs">
							{#each MEMORY_OPTIONS as v}
								<option value={v}>{v}</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			<!-- Submit results -->
			{#if submitResults.length > 0}
				<div class="border-border max-h-32 overflow-y-auto rounded-md border p-2 text-xs">
					{#each submitResults as r}
						<div class="flex items-center gap-1">
							{#if r.name}
								<span class="text-green-600">✓</span>
								<span class="font-mono">{r.combo}</span>
								<span class="text-muted-foreground">→ {r.name}</span>
							{:else}
								<span class="text-destructive">✗</span>
								<span class="font-mono">{r.combo}</span>
								<span class="text-destructive">{r.error}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if submitError}
				<p class="text-destructive text-sm">{submitError}</p>
			{/if}
		</div>

		<Dialog.Footer>
			<span class="text-muted-foreground mr-auto text-xs">
				{comboCount} combination{comboCount !== 1 ? 's' : ''}
			</span>
			<Button variant="outline" onclick={onclose} disabled={submitting}>Cancel</Button>
			<Button onclick={submit} disabled={submitting || comboCount === 0}>
				{submitting ? `Submitting ${comboCount}...` : `Run ${comboCount}`}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
