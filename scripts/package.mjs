import { packager } from '@electron/packager';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { symlink, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { version, releaseRoot, releaseDir, bundlePath } from './release-paths.mjs';
const cache = path.join(os.homedir(), 'Library/Caches/flots-build');
const archiveName = `electron-v${JSON.parse(readFileSync('node_modules/electron/package.json', 'utf8')).version}-darwin-arm64.zip`;
if (existsSync(bundlePath)) throw new Error(`Release v${version} already exists. Increment package.json before publishing another version.`);
if (existsSync(path.join(cache, archiveName))) {
  const expected = JSON.parse(readFileSync('node_modules/electron/checksums.json', 'utf8'))[archiveName];
  const actual = createHash('sha256').update(readFileSync(path.join(cache, archiveName))).digest('hex');
  if (!expected || actual !== expected) throw new Error('Cached Electron archive checksum mismatch');
}
const paths = await packager({ dir: '.', out: releaseDir, name: 'flots', icon: 'assets/flots.icns', executableName: 'flots', platform: 'darwin', arch: 'arm64', overwrite: false, asar: { unpack: '**/*.node' }, electronZipDir: existsSync(path.join(cache, archiveName)) ? cache : undefined, appBundleId: 'app.flots.browser', appCategoryType: 'public.app-category.productivity', prune: true, osxSign: { identity: '-', identityValidation: false, preAutoEntitlements: false, preEmbedProvisioningProfile: false, optionsForFile: () => ({ hardenedRuntime: true, timestamp: 'none', entitlements: ['com.apple.security.cs.allow-jit', 'com.apple.security.cs.disable-library-validation', 'com.apple.security.device.audio-input', 'com.apple.security.device.camera', 'com.apple.security.personal-information.location'] }) }, ignore: [/^\/native($|\/)/, /^\/\.snapshots($|\/)/, /^\/\.agents($|\/)/, /^\/\.electron-cache($|\/)/, /^\/src($|\/)/, /^\/tests($|\/)/, /^\/scripts($|\/)/, /^\/docs($|\/)/, /^\/.test-profiles($|\/)/, /^\/release($|\/)/, /^\/\.git($|\/)/], extendInfo: { CFBundleDisplayName: 'Flots', CFBundleURLTypes: [{ CFBundleURLName: 'Web links', CFBundleTypeRole: 'Viewer', CFBundleURLSchemes: ['http', 'https'] }], NSCameraUsageDescription: 'Websites you approve can use your camera.', NSMicrophoneUsageDescription: 'Websites you approve can use your microphone.', NSLocationWhenInUseUsageDescription: 'Websites you approve can request your location.' } });
console.log('Local development app (not Developer ID signed or notarized):', paths.join('\n'));

const shortcut = path.join(releaseRoot, '.Flots-next.app');
await symlink(path.relative(releaseRoot, bundlePath), shortcut);
await rename(shortcut, path.join(releaseRoot, 'Flots.app'));
await writeFile(path.join(releaseRoot, 'README.md'), `# Flots releases\n\nOpen Flots.app for the latest build (v${version}). Versioned applications are retained in v<version> folders. The original flots-darwin-arm64 folder is the first release and is preserved.\n\nLocal builds are not Developer ID signed or notarized. Quit an older Flots instance before opening the latest version.\n`);
