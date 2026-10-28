# Third-party notices

- Electron — MIT; https://github.com/electron/electron. Electron's LICENSE and Chromium's LICENSES.chromium.html ship with its runtime.
- Chromium — BSD and multiple third-party licenses. Preserve LICENSES.chromium.html in distributed bundles.
- @ghostery/adblocker and its @ghostery dependencies — MPL-2.0; https://github.com/ghostery/adblocker. Used unmodified. Package versions and resolved source archives are recorded in package-lock.json. Preserve MPL license text and source availability for these files in public distributions.
- @remusao dependencies — MPL-2.0; source archive URLs are recorded in package-lock.json.
- tldts-experimental and tldts-core — MIT; https://github.com/remusao/tldts.
- Original flots starter network-filter rules — MIT, in assets/network-filters.txt. No EasyList/EasyPrivacy subscription is bundled.
- Build/test tools include TypeScript (Apache-2.0), Vite (MIT), esbuild (MIT), Playwright (Apache-2.0), tsx (MIT), and Electron Packager (BSD-2-Clause). Consult each package's LICENSE and lockfile for transitive dependencies.

Build bundling retains legal comments. Dependencies' license files must accompany any redistributed bundle. `scripts/package.mjs` preserves production dependency trees and the root license/notices. Each public release includes SBOM.cdx.json for npm production dependencies. Electron/Chromium components retain their bundled LICENSE and LICENSES.chromium.html; they are not exhaustively enumerated by the npm inventory. The lockfile provides exact npm source archive URLs, including the unmodified MPL engine.
