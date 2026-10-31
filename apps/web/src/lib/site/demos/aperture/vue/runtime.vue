<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useFrame, usePointer, useSpektral } from 'spektral/vue';
import type { ProductInteraction } from '../../../demo-shared/product-interaction';
const props = defineProps<{ interaction: ProductInteraction }>();
const context = useSpektral();
const pointer = usePointer({
	capturePointer: true,
	trackWhilePressedOutsideCanvas: true,
	onClick: (click) => props.interaction.click(click.uv)
});
useFrame((frame) => props.interaction.update(frame, pointer.state.current), {
	autoInvalidate: false
});
let cleanup: (() => void) | undefined;
onMounted(() => {
	cleanup = props.interaction.connect(context);
});
onUnmounted(() => cleanup?.());
</script>
<template></template>
