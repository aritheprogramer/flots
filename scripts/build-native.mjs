import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
export function buildNative() {
  if (process.platform !== 'darwin') return;
  const candidates = [process.env.FLOTS_NODE_HEADERS, path.resolve(path.dirname(process.execPath), '../include/node'), '/opt/homebrew/include/node', '/usr/local/include/node'].filter(Boolean);
  const include = candidates.find(p => existsSync(path.join(p, 'node_api.h')));
  if (!include) throw new Error('Node C headers required for native Liquid Glass. Set FLOTS_NODE_HEADERS to a Node.js include/node directory.');
  mkdirSync('dist/native', { recursive: true });
  execFileSync('xcrun', ['clang++', '-std=c++17', '-fobjc-arc', '-shared', '-undefined', 'dynamic_lookup', '-framework', 'AppKit', '-arch', 'arm64', '-mmacosx-version-min=13.0', '-DNAPI_VERSION=8', '-I', include, 'native/glass.mm', '-o', 'dist/native/glass.node'], { stdio: 'inherit' });
}
