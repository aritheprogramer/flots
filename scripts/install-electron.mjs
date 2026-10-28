// Verified curl fallback for environments where @electron/get's network client stalls.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const pkg = JSON.parse(await readFile('node_modules/electron/package.json', 'utf8'));
const name = `electron-v${pkg.version}-darwin-arm64.zip`;
const cache = path.join(os.homedir(), 'Library/Caches/flots-build');
const archive = path.join(cache, name);
await mkdir(cache, { recursive: true });
try { await readFile(archive); } catch { execFileSync('curl', ['-fL', '--retry', '2', '--max-time', '300', `https://github.com/electron/electron/releases/download/v${pkg.version}/${name}`, '-o', archive], { stdio: 'inherit' }); }
const checksums = JSON.parse(await readFile('node_modules/electron/checksums.json', 'utf8'));
const actual = createHash('sha256').update(await readFile(archive)).digest('hex');
if (actual !== checksums[name]) throw new Error('Electron archive checksum mismatch');
await mkdir('node_modules/electron/dist', { recursive: true });
execFileSync('ditto', ['-xk', archive, path.resolve('node_modules/electron/dist')]);
await writeFile('node_modules/electron/path.txt', 'Electron.app/Contents/MacOS/Electron');
console.log(`Verified and extracted Electron ${pkg.version} for Apple Silicon.`);
