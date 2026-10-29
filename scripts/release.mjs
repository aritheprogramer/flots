// Build outside synchronized Documents folders; publish only after packaged smoke tests.
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { version, releaseRoot, releaseDir, bundlePath } from './release-paths.mjs';
if (existsSync(releaseDir)) throw new Error(`Release v${version} already exists. Increment package.json for the next release.`);
const source = process.cwd();
const cache = path.join(os.homedir(), 'Library/Caches/flots-build');
const localBundle = path.join(os.homedir(), 'Applications/Flots Builds', `v${version}`, 'Flots.app');
if (existsSync(localBundle)) throw new Error(`Local build already exists: ${localBundle}`);
await mkdir(cache, { recursive: true });
const staging = await mkdtemp(path.join(cache, `release-${version}-`));
const run = (command, args, extraEnv = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: staging, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}; staging preserved at ${staging}`)));
});
console.log(`Building Flots v${version} in a local temporary workspace.`);
for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'src', 'native', 'scripts']) {
  await cp(path.join(source, file), path.join(staging, file), { recursive: true });
}
await mkdir(path.join(staging, 'assets'));
for (const file of ['flots.icns', 'flots-wave-mask.png', 'network-filters.txt']) await cp(path.join(source, 'assets', file), path.join(staging, 'assets', file));
await mkdir(path.join(staging, 'docs'));
await run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
await run(process.execPath, ['scripts/install-electron.mjs']);
await run('npm', ['run', 'build']);
await run(process.execPath, ['scripts/package.mjs']);
await run(process.execPath, ['scripts/package-smoke.mjs']);
await run(process.execPath, ['scripts/dmg.mjs']);
const { stdout: sbom } = await promisify(execFile)('npm', ['sbom', '--omit=dev', '--sbom-format', 'cyclonedx'], { cwd: staging, maxBuffer: 8 * 1024 * 1024 });
await writeFile(path.join(staging, 'release', `v${version}`, 'SBOM.cdx.json'), sbom);
await mkdir(releaseRoot, { recursive: true });
await mkdir(path.dirname(localBundle), { recursive: true });
await cp(path.join(staging, 'release', `v${version}`, 'flots-darwin-arm64/flots.app'), localBundle, { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false });
await run('codesign', ['--verify', '--deep', '--strict', localBundle]);
await run(process.execPath, ['scripts/package-smoke.mjs'], { FLOTS_SMOKE_BUNDLE: localBundle });
await mkdir(path.dirname(bundlePath), { recursive: true });
for (const name of [`Flots-${version}-macOS-arm64.dmg`, 'SHA256SUMS.txt', 'SBOM.cdx.json']) {
  await cp(path.join(staging, 'release', `v${version}`, name), path.join(releaseDir, name), { errorOnExist: true, force: false });
}
await symlink(localBundle, bundlePath);
const next = path.join(releaseRoot, `.Flots-${process.pid}.app`);
await symlink(path.relative(releaseRoot, bundlePath), next);
await rename(next, path.join(releaseRoot, 'Flots.app'));
await cp(path.join(staging, 'docs/installer-results.json'), path.join(source, 'docs/installer-results.json'));
await cp(path.join(staging, 'docs/package-results.json'), path.join(source, 'docs/package-results.json'));
await writeFile(path.join(releaseRoot, 'README.md'), `# Flots releases\n\nDouble-click Flots.app for the latest verified application (v${version}). Older versions remain in their numbered folders. The original flots-darwin-arm64 folder contains v0.1.0 and is preserved.\n\nQuit an older Flots instance before opening the latest version. Local builds are not Developer ID signed or notarized.\n`);
await writeFile(path.join(releaseDir, 'release.json'), JSON.stringify({ version, created: new Date().toISOString(), platform: 'darwin', arch: 'arm64', smoke: JSON.parse(await readFile(path.join(staging, 'docs/package-results.json'), 'utf8')) }, null, 2));
await rm(staging, { recursive: true, force: true });
console.log(`Verified release: ${bundlePath}\nLatest shortcut: ${path.join(releaseRoot, 'Flots.app')}`);
