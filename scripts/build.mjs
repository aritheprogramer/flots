import { buildNative } from './build-native.mjs';
buildNative();
import { build } from 'esbuild';
import { build as vite } from 'vite';
await build({ entryPoints: ['src/main/main.ts', 'src/main/preload.ts'], outdir: 'dist/main', outExtension: { '.js': '.cjs' }, bundle: true, platform: 'node', target: 'node24', external: ['electron'], sourcemap: true });
await vite({ root: 'src/renderer', base: './', build: { outDir: '../../dist/renderer', emptyOutDir: true }, logLevel: 'warn' });
