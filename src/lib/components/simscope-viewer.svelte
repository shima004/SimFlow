<script lang="ts">
	// SimScope viewer popup.
	// Opens SimScope in a dialog via iframe, passing simulation parameters as URL query params.
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { Button } from '$lib/components/ui/button';

	let {
		baseUrl,
		url = '',
		host = '',
		port = '',
		map = '',
		agent = ''
	}: {
		baseUrl: string;
		url?: string;
		host?: string;
		port?: string;
		map?: string;
		agent?: string;
	} = $props();

	let open = $state(false);

	// Build the SimScope iframe URL with provided query params
	let iframeSrc = $derived(() => {
		const params = new URLSearchParams();
		if (url) params.set('url', url);
		if (host) params.set('host', host);
		if (port) params.set('port', port);
		if (map) params.set('map', map);
		if (agent) params.set('team', agent);
		const qs = params.toString();
		return qs ? `${baseUrl}?${qs}` : baseUrl;
	});
</script>

<Button variant="outline" size="sm" onclick={() => (open = true)}>
	Open in SimScope
</Button>

<DialogPrimitive.Root bind:open>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<DialogPrimitive.Content
			class="bg-background fixed top-1/2 left-1/2 z-50 flex h-[90vh] w-[90vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl shadow-lg outline-none"
		>
			<div class="flex-none flex items-center justify-between border-b px-4 py-3">
				<p class="text-sm font-medium">
					SimScope
					{#if map}<span class="text-muted-foreground font-normal"> — Map: {map}</span>{/if}
					{#if agent}<span class="text-muted-foreground font-normal"> / Agent: {agent}</span>{/if}
				</p>
				<Button size="sm" variant="ghost" onclick={() => window.open(iframeSrc(), '_blank')}>
					別画面で開く
				</Button>
			</div>
			{#if open}
				<iframe
					src={iframeSrc()}
					title="SimScope Viewer"
					class="min-h-0 flex-1 rounded-b-xl border-none"
					allow="fullscreen"
				></iframe>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
