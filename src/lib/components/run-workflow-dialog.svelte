<script lang="ts">
	// Dialog for submitting a workflow run.
	// Language selects the WorkflowTemplate; agent and map are chosen from S3 bucket keys.
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	type Props = {
		open: boolean;
		onclose: () => void;
		onsubmitted: (workflowName: string) => void;
		agentKeys: string[];
		mapKeys: string[];
		defaultAgent?: string;
		defaultMap?: string;
	};

	let {
		open = $bindable(),
		onclose,
		onsubmitted,
		agentKeys,
		mapKeys,
		defaultAgent = '',
		defaultMap = ''
	}: Props = $props();

	// Language → WorkflowTemplate name mapping
	const LANGUAGES = [
		{ label: 'Python', template: 'rrs-workflow-python' },
		{ label: 'Java', template: 'rrs-workflow-java' }
	] as const;
	type Language = (typeof LANGUAGES)[number];

	let language = $state<Language>(LANGUAGES[0]);
	let agent = $state('');
	let map = $state('');
	let tag = $state('default');
	let agentSearch = $state('');
	let mapSearch = $state('');
	let submitting = $state(false);
	let submitError = $state('');

	let filteredAgents = $derived(
		(agentKeys ?? []).filter((a) => a.toLowerCase().includes(agentSearch.toLowerCase()))
	);
	let filteredMaps = $derived(
		(mapKeys ?? []).filter((m) => m.toLowerCase().includes(mapSearch.toLowerCase()))
	);

	$effect(() => {
		if (open) {
			agent = defaultAgent;
			map = defaultMap;
			submitError = '';
			agentSearch = '';
			mapSearch = '';
		}
	});

	async function submit() {
		if (!agent || !map) return;
		submitting = true;
		submitError = '';
		try {
			const res = await fetch('/api/workflow/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ template: language.template, agent, map, tag: tag || 'default' })
			});
			if (!res.ok) throw new Error(await res.text());
			const { name } = await res.json();
			onsubmitted(name);
			open = false;
		} catch (e) {
			submitError = e instanceof Error ? e.message : String(e);
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={(v) => { if (!v) onclose(); }}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Run Workflow</Dialog.Title>
			<Dialog.Description>Submit a new workflow run.</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-2">
			<!-- Language toggle -->
			<div class="space-y-1">
				<p id="language-label" class="text-sm font-medium">Language</p>
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

			<!-- Agent selector -->
			<div class="space-y-1">
				<p id="agent-label" class="text-sm font-medium">
					Agent
					{#if agent}<span class="text-muted-foreground font-normal">— {agent}</span>{/if}
				</p>
				<Input
					placeholder="Filter agents..."
					bind:value={agentSearch}
					class="h-7 text-xs"
				/>
				<div class="border-border max-h-36 overflow-y-auto rounded-md border">
					{#each filteredAgents as a}
						<button
							class="hover:bg-muted w-full px-2 py-1 text-left font-mono text-xs transition-colors"
							class:bg-muted={agent === a}
							class:font-semibold={agent === a}
							onclick={() => (agent = a)}
						>
							{a}
						</button>
					{:else}
						<p class="text-muted-foreground px-2 py-2 text-xs">No matches</p>
					{/each}
				</div>
			</div>

			<!-- Map selector -->
			<div class="space-y-1">
				<p id="map-label" class="text-sm font-medium">
					Map
					{#if map}<span class="text-muted-foreground font-normal">— {map}</span>{/if}
				</p>
				<Input
					placeholder="Filter maps..."
					bind:value={mapSearch}
					class="h-7 text-xs"
				/>
				<div class="border-border max-h-36 overflow-y-auto rounded-md border">
					{#each filteredMaps as m}
						<button
							class="hover:bg-muted w-full px-2 py-1 text-left font-mono text-xs transition-colors"
							class:bg-muted={map === m}
							class:font-semibold={map === m}
							onclick={() => (map = m)}
						>
							{m}
						</button>
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

			{#if submitError}
				<p class="text-destructive text-sm">{submitError}</p>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onclose} disabled={submitting}>Cancel</Button>
			<Button onclick={submit} disabled={submitting || !agent || !map}>
				{submitting ? 'Submitting...' : 'Run'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
