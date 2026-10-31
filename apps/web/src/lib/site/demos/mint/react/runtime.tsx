import { useEffect } from 'react';
import { useFrame, usePointer, useSpektral } from 'spektral/react';
import type { ProductInteraction } from '../../../demo-shared/product-interaction';
export default function Runtime({ interaction }: { interaction: ProductInteraction }) {
	const context = useSpektral();
	const pointer = usePointer({
		capturePointer: true,
		trackWhilePressedOutsideCanvas: true,
		onClick: (click) => interaction.click(click.uv)
	});
	useFrame((frame) => interaction.update(frame, pointer.state.current), { autoInvalidate: false });
	useEffect(() => interaction.connect(context), [context, interaction]);
	return null;
}
