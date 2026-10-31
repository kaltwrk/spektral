<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useFrame, usePointer, useSpektral } from 'spektral/vue';
import { createPrismInteraction } from '../interaction';
const interaction = createPrismInteraction();
const context = useSpektral();
const pointer = usePointer({
	capturePointer: true,
	trackWhilePressedOutsideCanvas: true,
	onClick: (click) => interaction.click(click.uv)
});
useFrame((frame) => interaction.update(frame, pointer.state.current), { autoInvalidate: false });
let cleanup: (() => void) | undefined;
onMounted(() => {
	cleanup = interaction.connect(context);
});
onUnmounted(() => cleanup?.());
</script>
<template></template>
