<script lang="ts">
	import { FragCanvas } from 'spektral/svelte';
	import { studioColor } from '../../../demo-shared/presentation';
	import { createApertureScene, reportSceneError } from '../material';
	import Runtime from './runtime.svelte';
	const { material, passes, interaction } = createApertureScene();
</script>

<FragCanvas
	{material}
	{passes}
	renderMode="on-demand"
	maxDelta={1 / 30}
	color={studioColor}
	showErrorOverlay={false}
	onError={reportSceneError}
	style="display:block;width:100%;height:100%;touch-action:none"
>
	<Runtime {interaction} />
</FragCanvas>
