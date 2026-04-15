<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { can } from '$lib/permissions';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const role = $derived(data.user?.role);

	const CPU_OPTIONS = Array.from({ length: 8 }, (_, i) => `${(i + 1) * 2000}m`);
	const MEMORY_OPTIONS = Array.from({ length: 8 }, (_, i) => `${(i + 1) * 4}Gi`);

	let showForm = $state(false);
	let name = $state('');
	let selectedAgents = $state(new Set<string>());
	let selectedMaps = $state(new Set<string>());
	let agentSearch = $state('');
	let mapSearch = $state('');
	let template = $state('rrs-workflow-python');
	let serverCpu = $state('4000m');
	let serverMemory = $state('8Gi');
	let agentCpu = $state('4000m');
	let agentMemory = $state('8Gi');

	let filteredAgents = $derived(
		data.agentKeys.filter((a) => a.toLowerCase().includes(agentSearch.toLowerCase()))
	);
	let filteredMaps = $derived(
		data.mapKeys.filter((m) => m.toLowerCase().includes(mapSearch.toLowerCase()))
	);

	function toggleAgent(a: string) {
		const next = new Set(selectedAgents);
		next.has(a) ? next.delete(a) : next.add(a);
		selectedAgents = next;
	}

	function toggleMap(m: string) {
		const next = new Set(selectedMaps);
		next.has(m) ? next.delete(m) : next.add(m);
		selectedMaps = next;
	}

	function toggleAllAgents() {
		selectedAgents =
			filteredAgents.every((a) => selectedAgents.has(a))
				? new Set([...selectedAgents].filter((a) => !filteredAgents.includes(a)))
				: new Set([...selectedAgents, ...filteredAgents]);
	}

	function toggleAllMaps() {
		selectedMaps =
			filteredMaps.every((m) => selectedMaps.has(m))
				? new Set([...selectedMaps].filter((m) => !filteredMaps.includes(m)))
				: new Set([...selectedMaps, ...filteredMaps]);
	}
</script>

<main class="mx-auto max-w-5xl p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Competitions</h1>
		{#if can(role, 'competitions:manage')}
			<Button onclick={() => (showForm = !showForm)}>
				{showForm ? 'Cancel' : 'New Competition'}
			</Button>
		{/if}
	</div>

	{#if showForm && can(role, 'competitions:manage')}
		<form
			method="POST"
			action="?/create"
			use:enhance
			class="bg-muted/40 mb-6 rounded-xl border p-5 space-y-4"
		>
			{#if form?.error}
				<p class="text-destructive text-sm">{form.error}</p>
			{/if}

			<div>
				<label class="mb-1 block text-sm font-medium" for="name">Name</label>
				<Input id="name" name="name" bind:value={name} placeholder="Competition name" required />
			</div>

			<div class="grid grid-cols-2 gap-4">
				<!-- Agents -->
				<div>
					<p class="mb-1 text-sm font-medium">Agents ({selectedAgents.size} selected)</p>
					<Input bind:value={agentSearch} placeholder="Search agents..." class="mb-2" />
					<div class="border rounded-md overflow-hidden">
						<button
							type="button"
							onclick={toggleAllAgents}
							class="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted border-b"
						>
							{filteredAgents.every((a) => selectedAgents.has(a)) ? 'Deselect all' : 'Select all'}
						</button>
						<div class="max-h-48 overflow-y-auto">
							{#each filteredAgents as agent}
								<label class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-sm">
									<input
										type="checkbox"
										name="agents"
										value={agent}
										checked={selectedAgents.has(agent)}
										onchange={() => toggleAgent(agent)}
									/>
									<span class="font-mono truncate">{agent}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>

				<!-- Maps -->
				<div>
					<p class="mb-1 text-sm font-medium">Maps ({selectedMaps.size} selected)</p>
					<Input bind:value={mapSearch} placeholder="Search maps..." class="mb-2" />
					<div class="border rounded-md overflow-hidden">
						<button
							type="button"
							onclick={toggleAllMaps}
							class="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted border-b"
						>
							{filteredMaps.every((m) => selectedMaps.has(m)) ? 'Deselect all' : 'Select all'}
						</button>
						<div class="max-h-48 overflow-y-auto">
							{#each filteredMaps as map}
								<label class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-sm">
									<input
										type="checkbox"
										name="maps"
										value={map}
										checked={selectedMaps.has(map)}
										onchange={() => toggleMap(map)}
									/>
									<span class="font-mono truncate">{map}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<!-- Resource settings -->
			<div>
				<p class="mb-2 text-sm font-medium">Resources</p>
				<div class="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
					<label class="space-y-1">
						<span class="text-muted-foreground text-xs">Server CPU</span>
						<select name="server_cpu" bind:value={serverCpu} class="border-input bg-background h-8 w-full rounded border px-2 text-sm">
							{#each CPU_OPTIONS as v}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="space-y-1">
						<span class="text-muted-foreground text-xs">Server Memory</span>
						<select name="server_memory" bind:value={serverMemory} class="border-input bg-background h-8 w-full rounded border px-2 text-sm">
							{#each MEMORY_OPTIONS as v}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="space-y-1">
						<span class="text-muted-foreground text-xs">Agent CPU</span>
						<select name="agent_cpu" bind:value={agentCpu} class="border-input bg-background h-8 w-full rounded border px-2 text-sm">
							{#each CPU_OPTIONS as v}<option value={v}>{v}</option>{/each}
						</select>
					</label>
					<label class="space-y-1">
						<span class="text-muted-foreground text-xs">Agent Memory</span>
						<select name="agent_memory" bind:value={agentMemory} class="border-input bg-background h-8 w-full rounded border px-2 text-sm">
							{#each MEMORY_OPTIONS as v}<option value={v}>{v}</option>{/each}
						</select>
					</label>
				</div>
			</div>

			<div class="flex items-center justify-between">
				<p class="text-muted-foreground text-sm">
					{selectedAgents.size} agents × {selectedMaps.size} maps = {selectedAgents.size * selectedMaps.size} runs
				</p>
				<Button type="submit" disabled={!name || selectedAgents.size === 0 || selectedMaps.size === 0}>
					Create
				</Button>
			</div>
		</form>
	{/if}

	{#if data.competitions.length === 0}
		<p class="text-muted-foreground text-sm">No competitions yet.</p>
	{:else}
		<div class="space-y-2">
			{#each data.competitions as comp}
				<a
					href="/competition/{comp.id}"
					class="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted transition-colors"
				>
					<span class="font-medium">{comp.name}</span>
					<span class="text-muted-foreground text-sm">{new Date(comp.created_at).toLocaleString()}</span>
				</a>
			{/each}
		</div>
	{/if}
</main>
