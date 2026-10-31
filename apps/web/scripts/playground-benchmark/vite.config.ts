import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const baselineDir = process.env.SPEKTRAL_BASELINE_DIR;
const factories = {
	amber: 'createAmberScene',
	ferrofluid: 'createFerrofluidScene',
	'kinetic-array': 'createKineticScene',
	nixie: 'createNixieScene',
	prism: 'createPrismScene',
	signal: 'createSignalScene'
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
				const imports = Object.entries(factories)
					.map(
						([demo, factory]) =>
							`import { ${factory} } from ${JSON.stringify('/@fs' + resolve(baselineDir, 'demos', demo, 'material.ts'))};`
					)
					.join('\n');
				return `${imports}\nexport const baselineFactories={${Object.entries(factories)
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
