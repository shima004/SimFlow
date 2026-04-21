<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let token = $state('');
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="w-full max-w-sm space-y-6">
		<div class="text-center">
			<h1 class="text-2xl font-semibold">SimFlow</h1>
			<p class="text-muted-foreground mt-1 text-sm">JWTトークンでログイン</p>
		</div>

		<form method="POST" class="space-y-4">
			{#if form?.error}
				<p class="text-destructive rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
					{form.error}
				</p>
			{/if}

			<div class="space-y-1">
				<label class="text-sm font-medium" for="token">JWT Token</label>
				<textarea
					id="token"
					name="token"
					bind:value={token}
					rows="5"
					placeholder="eyJ..."
					class="border-input bg-background w-full rounded-md border px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
					required
				></textarea>
			</div>

			<Button type="submit" class="w-full">ログイン</Button>
		</form>
	</div>
</div>
