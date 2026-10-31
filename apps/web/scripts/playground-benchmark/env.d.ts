declare module 'virtual:benchmark-baseline' {
	export const baselineFactories: Partial<
		Record<import('./cases').Demo, () => import('./cases').Scene>
	>;
}
