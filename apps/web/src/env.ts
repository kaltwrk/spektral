import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_PLAYGROUND_PREVIEW_ORIGIN: {
		public: true,
		schema: (value: string | undefined) => value
	},
	PLAYGROUND_PREVIEW_PARENT_ORIGINS: {
		schema: (value: string | undefined) => value
	}
});
