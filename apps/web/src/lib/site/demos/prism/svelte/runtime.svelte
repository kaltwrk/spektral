<script lang="ts">
	import { onMount } from 'svelte';
	import { useFrame, usePointer, useSpektral } from 'spektral/svelte';
	import { createPrismInteraction } from '../interaction';
	const interaction = createPrismInteraction();
	const context = useSpektral();
	const pointer = usePointer({
		capturePointer: true,
		trackWhilePressedOutsideCanvas: true,
		onClick: (click) => interaction.click(click.uv)
	});
	useFrame((frame) => interaction.update(frame, pointer.state.current), { autoInvalidate: false });
	onMount(() => interaction.connect(context));
</script>
