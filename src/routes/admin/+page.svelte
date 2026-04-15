<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const ROLES = ['admin', 'operator', 'competition-upload', 'competition', 'viewer'] as const;
	let newSubject = $state('');
	let newRole = $state<'admin' | 'operator' | 'competition-upload' | 'competition' | 'viewer'>('viewer');
	let expiresDays = $state(30);
	let copied = $state(false);

	function copyToken(token: string) {
		navigator.clipboard.writeText(token).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}
</script>

<main class="mx-auto max-w-3xl p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold">ユーザー管理</h1>
		<p class="text-muted-foreground text-sm">JWTの sub クレームでユーザーを登録し、ロールを割り当てます</p>
	</div>

	<!-- Add user -->
	<form method="POST" action="?/addUser" use:enhance class="bg-muted/40 mb-6 rounded-xl border p-4 space-y-3">
		<h2 class="font-medium">ユーザーを追加</h2>
		{#if form?.error}
			<p class="text-destructive text-sm">{form.error}</p>
		{/if}
		<div class="flex gap-3">
			<Input
				name="subject"
				bind:value={newSubject}
				placeholder="JWT sub クレーム（例: user@example.com）"
				class="flex-1"
				required
			/>
			<select name="role" bind:value={newRole} class="border-input bg-background rounded-md border px-3 text-sm">
				{#each ROLES as r}<option value={r}>{r}</option>{/each}
			</select>
			<Button type="submit">追加</Button>
		</div>
	</form>

	<!-- Issued JWT display -->
	{#if form?.issuedToken}
		<div class="mb-6 rounded-xl border bg-green-50 p-4 space-y-2 dark:bg-green-950">
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium">JWT発行完了 — <span class="font-mono">{form.issuedSubject}</span></p>
				<Button
					size="sm"
					variant="outline"
					class="h-7 text-xs"
					onclick={() => copyToken(form!.issuedToken!)}
				>
					{copied ? 'コピー済み ✓' : 'コピー'}
				</Button>
			</div>
			<textarea
				readonly
				rows="3"
				class="w-full rounded border bg-white px-3 py-2 font-mono text-xs dark:bg-black"
				value={form.issuedToken}
			></textarea>
		</div>
	{/if}

	<!-- JWT expiry setting -->
	<div class="mb-4 flex items-center gap-3 text-sm">
		<span class="text-muted-foreground">JWT有効期限:</span>
		<input
			type="number"
			bind:value={expiresDays}
			min="1"
			max="365"
			class="border-input bg-background w-20 rounded border px-2 py-1 text-sm"
		/>
		<span class="text-muted-foreground">日</span>
	</div>

	<!-- User list -->
	<div class="rounded-lg border overflow-hidden">
		<table class="w-full text-sm">
			<thead>
				<tr class="bg-muted border-b">
					<th class="px-4 py-2 text-left font-medium">Subject</th>
					<th class="px-4 py-2 text-left font-medium">ロール</th>
					<th class="px-4 py-2 text-left font-medium">登録日時</th>
					<th class="w-28 px-4 py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user}
					<tr class="border-b last:border-0">
						<td class="px-4 py-2 font-mono text-xs">{user.subject}</td>
						<td class="px-4 py-2">
							<form method="POST" action="?/updateRole" use:enhance>
								<input type="hidden" name="id" value={user.id} />
								<select
									name="role"
									class="border-input bg-background rounded border px-2 py-1 text-xs"
									value={user.role}
									onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
								>
									{#each ROLES as r}<option value={r}>{r}</option>{/each}
								</select>
							</form>
						</td>
						<td class="text-muted-foreground px-4 py-2 text-xs">{new Date(user.created_at).toLocaleString()}</td>
						<td class="px-4 py-2">
							<div class="flex gap-2">
								<form method="POST" action="?/issueJwt" use:enhance>
									<input type="hidden" name="subject" value={user.subject} />
									<input type="hidden" name="expires_days" value={expiresDays} />
									<Button type="submit" size="sm" variant="outline" class="h-7 text-xs">JWT発行</Button>
								</form>
								<form method="POST" action="?/deleteUser" use:enhance>
									<input type="hidden" name="id" value={user.id} />
									<Button type="submit" size="sm" variant="destructive" class="h-7 text-xs">削除</Button>
								</form>
							</div>
						</td>
					</tr>
				{:else}
					<tr><td colspan="4" class="text-muted-foreground px-4 py-4 text-center text-sm">ユーザーなし</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</main>
