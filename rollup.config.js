import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';

export default {
	input: 'components/index.js',
	output: [
		{ file: 'site/assets/components.mjs', 'format': 'es' }
	],
	plugins: [
		svelte(),
		resolve()
	]
};
