import { readFileSync } from 'node:fs';
import path from 'node:path';
export const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid release version');
export const releaseRoot = path.resolve('release');
export const releaseDir = path.join(releaseRoot, `v${version}`);
export const bundlePath = path.join(releaseDir, 'flots-darwin-arm64', 'flots.app');
