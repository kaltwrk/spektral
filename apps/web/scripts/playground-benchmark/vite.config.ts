import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
const baselineDir = process.env.SPEKTRAL_BASELINE_DIR;
const factories = {
	amber: 'createAmberScene',
	ferrofluid: 'createFerrofluidScene',
	'kinetic-array': 'createKineticScene',
	nixie: 'createNixieScene',
	prism: 'createPrismScene',
	signal: 'createSignalScene',
	aperture: 'createApertureScene',
	mint: 'createMintScene'
};
export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	publicDir: fileURLToPath(new URL('../../static', import.meta.url)),
	resolve: {
		alias: {
			spektral: fileURLToPath(
				new URL('../../../../packages/spektral/src/lib/index.ts', import.meta.url)
			)
		}
	},
	plugins: [
		{
			name: 'benchmark-baseline',
			resolveId(id) {
				if (id === 'virtual:benchmark-baseline') return '\0benchmark-baseline';
			},
			load(id) {
				if (id !== '\0benchmark-baseline') return;
				if (!baselineDir) return 'export const baselineFactories = {};';
				const available = Object.entries(factories).filter(([demo]) =>
					existsSync(resolve(baselineDir, 'demos', demo, 'material.ts'))
				);
				const imports = available
					.map(
						([demo, factory]) =>
							`import { ${factory} } from ${JSON.stringify('/@fs' + resolve(baselineDir, 'demos', demo, 'material.ts'))};`
					)
					.join('\n');
				return `${imports}\nexport const baselineFactories={${available
					.map(([demo, factory]) => `${JSON.stringify(demo)}:${factory}`)
					.join(',')}};`;
			}
		}
	],
	server: {
		host: '127.0.0.1',
		port: 4182,
		strictPort: true,
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		},
		fs: {
			allow: [
				fileURLToPath(new URL('../../../..', import.meta.url)),
				...(baselineDir ? [resolve(baselineDir)] : [])
			]
		}
	}
});
