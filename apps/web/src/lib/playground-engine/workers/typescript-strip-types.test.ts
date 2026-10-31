import { describe, expect, it } from 'vitest';
import { parse } from 'acorn';
import { strip_types } from './typescript-strip-types';

describe('playground TypeScript erasure', () => {
	it('erases type-only class field modifiers without changing runtime fields', () => {
		const output = strip_types(
			`class Pass { readonly label = 'geometry'; private readonly size: number = 4; device?: object; buffer!: object; declare unused: string; }`
		);
		expect(() => parse(output, { ecmaVersion: 'latest' })).not.toThrow();
		expect(output).toContain("label = 'geometry'");
		expect(output).not.toContain('unused');
	});
	it('erases optional arrow arguments and preserves defaults', () => {
		const output = strip_types(
			'const rotate = (x: number, axis?: string, angle = 0): number => x + angle;'
		);
		expect(() => parse(output, { ecmaVersion: 'latest' })).not.toThrow();
		expect(output).toContain('angle = 0');
	});
	it('accepts every standalone TypeScript module shipped in the playground', () => {
		const modules = import.meta.glob('/src/lib/site/{demos,demo-shared}/**/*.ts', {
			query: '?raw',
			import: 'default',
			eager: true
		}) as Record<string, string>;
		for (const [path, code] of Object.entries(modules)) {
			if (path.endsWith('.d.ts')) continue;
			expect(
				() => parse(strip_types(code), { ecmaVersion: 'latest', sourceType: 'module' }),
				path
			).not.toThrow();
		}
	});
});
