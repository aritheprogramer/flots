import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdir, mkdtemp, rm, symlink, writeFile, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { version, releaseDir, bundlePath } from './release-paths.mjs';
const exec = promisify(execFile);
const cache = path.join(os.homedir(), 'Library/Caches/flots-build');
await mkdir(cache, { recursive: true });
const staging = await mkdtemp(path.join(cache, 'installer-'));
const image = path.join(releaseDir, `Flots-${version}-macOS-arm64.dmg`);
let mount;
try {
  const contents = path.join(staging, 'contents'); await mkdir(contents);
  await cp(bundlePath, path.join(contents, 'Flots.app'), { recursive: true, verbatimSymlinks: true });
  await symlink('/Applications', path.join(contents, 'Applications'));
  await writeFile(path.join(contents, 'Installation.txt'), `Flots ${version}\n\nDrag Flots.app to Applications, then open it from Applications.\nRequires an Apple Silicon Mac. Tested on macOS 27.\n\nThis free preview is not Developer ID signed or notarized. macOS may block its first launch. If you trust the release you downloaded, use the per-app Open Anyway option in System Settings > Privacy & Security after trying to open it. Do not disable Gatekeeper globally.\n\niCloud passkeys, DRM streaming and Chrome extensions are not available. See the repository README for compatibility and updates.\n\nQuit any earlier Flots version before installing an update. Your browser profile is stored separately and is retained.\n`);
  await exec('codesign', ['--verify', '--deep', '--strict', path.join(contents, 'Flots.app')]);
  await exec('hdiutil', ['create', '-volname', `Flots ${version}`, '-srcfolder', contents, '-ov', '-format', 'UDZO', image]);
  await exec('hdiutil', ['verify', image]);
  mount = path.join(staging, 'mounted'); await mkdir(mount);
  await exec('hdiutil', ['attach', image, '-readonly', '-nobrowse', '-mountpoint', mount]);
  const installed = path.join(mount, 'Flots.app');
  const { stdout } = await exec('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleShortVersionString', path.join(installed, 'Contents/Info.plist')]);
  if (stdout.trim() !== version) throw new Error('Disk image contains the wrong version');
  await exec(process.execPath, ['scripts/package-smoke.mjs'], { env: { ...process.env, FLOTS_SMOKE_BUNDLE: installed }, maxBuffer: 2 * 1024 * 1024 });
  await exec('hdiutil', ['detach', mount]); mount = undefined;
  const hash = createHash('sha256'); for await (const chunk of createReadStream(image)) hash.update(chunk);
  const sha256 = hash.digest('hex');
  await writeFile(path.join(releaseDir, 'SHA256SUMS.txt'), `${sha256}  ${path.basename(image)}\n`);
  await writeFile('docs/installer-results.json', JSON.stringify({ version, format: 'dmg', architecture: 'arm64', verified: true, mountedLaunch: JSON.parse(await readFile('docs/package-results.json', 'utf8')), adHocSignatureVerified: true, hardenedRuntime: true, developerIDSigned: false, notarized: false, sha256 }, null, 2));
  console.log(`Verified disk image: ${image}`);
} finally {
  if (mount) await exec('hdiutil', ['detach', mount]);
  await rm(staging, { recursive: true, force: true });
}
