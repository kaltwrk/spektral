import { useState } from 'react';
import { FragCanvas } from 'spektral/react';
import { studioColor } from '../../../demo-shared/presentation';
import { createKineticScene, reportSceneError } from '../material';
import Runtime from './runtime';

export default function App() {
	const [{ material, passes }] = useState(createKineticScene);
	return (
		<FragCanvas
			material={material}
			passes={passes}
			renderMode="always"
			maxDelta={1 / 30}
			color={studioColor}
			showErrorOverlay={false}
			onError={reportSceneError}
			style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
		>
			<Runtime />
		</FragCanvas>
	);
}
