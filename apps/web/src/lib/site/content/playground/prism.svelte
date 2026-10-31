<script module lang="ts">
	import type { ContentFrontmatter } from '$lib/content/types';
	export const metadata = {
		title: 'Prism',
		description:
			'Split white light through cut crystal and project a spectral caustic with an on-demand compute pass.',
		order: 60,
		data: { demo: 'prism' }
	} satisfies ContentFrontmatter;
</script>

<script lang="ts">
	import PlaygroundPage from '$lib/features/playground/PlaygroundPage.svelte';
</script>

<PlaygroundPage demoId={metadata.data.demo} title={metadata.title} />
