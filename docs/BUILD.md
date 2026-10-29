# Build and distribution

Requirements: macOS ARM64, Node.js >=22 (24.8.0 used here), npm, Node C headers and Command Line Tools with the macOS26+ SDK. No Xcode IDE or Chromium source build is needed for the local unsigned app. `npm ci` installs pinned dependencies. `npm run build` runs strict TypeScript checking and bundles main/preload with esbuild and the UI with Vite. `npm run package` uses Electron Packager for ARM64 and ASAR.

Output: `release/v<version>/flots-darwin-arm64/flots.app`, with `release/Flots.app` pointing to the latest verified build (currently v0.3.3). The normal profile is Electron's `userData` directory for flots, usually `~/Library/Application Support/flots`; the persistent Chromium partition is under it. Metadata is `session.json`. Do not edit a profile while the app is running. Back up the full profile to preserve cookies and state.

## Troubleshooting

- If `Electron failed to install correctly` occurs or its downloader stalls, run `npm run install:electron`. This project-local fallback downloads the exact pinned official ARM64 ZIP with curl and checks SHA-256 against Electron's package checksums before extracting with `ditto`. A partial cache file fails verification; delete only that ZIP under `~/Library/Caches/flots-build` and retry. Normal dependency installation should not need this fallback.
- Packaging reuses the verified ZIP when present. Otherwise Electron Packager downloads it normally. Never replace an archive with a different version under the same name.
- If an older development instance is open, quit it before launching another normal-profile instance. Single-instance protection is intentional.
- The packaged app is not notarized. Download only from the official repository or build from reviewed source; do not disable macOS protections globally.
- If `session.json` is malformed, flots preserves a `.corrupt-TIMESTAMP` copy and starts with defaults. Disk-full/write errors are logged; closing reports a save failure.
- `npm run test:runtime` and `npm run benchmark` require a logged-in graphical macOS session and network access. They open temporary test windows and use isolated profiles. No test disables web security, certificate checks or sandboxing.
- Real sites can deny embedded browsers, require unavailable DRM, use unsupported popup flows or require extra system permissions. Record exact URLs and errors instead of changing browser security defaults.

## Public distribution

The free preview is distributed as a verified ARM64 DMG with SHA-256 checksums and a CycloneDX production-dependency inventory. It is not Developer ID signed or notarized. An Apple Developer subscription is not required to build or publish this preview; macOS may require the user to explicitly allow its first launch. See the README and Apple's per-app procedure. Never disable Gatekeeper globally.

Updates are manual. Electron/Chromium security updates remain the project's responsibility. Developer ID signing, notarization and a signed automatic updater are future distribution improvements, not features of this release. The preview has not undergone an independent security audit.

Sources: [Electron packaging](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging), [Electron signing](https://www.electronjs.org/docs/latest/tutorial/code-signing).

## V3 native glass build

`npm run build` also compiles native/glass.mm with xcrun clang++ using Apple's AppKit framework and stable Node-API8. Requires CLT with macOS26+ SDK and Node headers (the standard Homebrew/Node installer paths are discovered, or set FLOTS_NODE_HEADERS). No network or native package install script is run by this step. The ARM64 module is unpacked outside ASAR at packaging. NSGlassEffectView is enabled only on macOS26+; accessibility settings disable it. SDK26 compiled successfully on the macOS27 host.

V3 builds to a versioned release/v<version> directory so an older running bundle is not overwritten. Quit older Flots windows normally before opening the new bundle; the normal user profile is preserved. `scripts/package-smoke.mjs` sets FLOTS_PACKAGED_SMOKE=1 and FLOTS_PROFILE to a fresh temporary directory solely to validate the packaged binary in isolation. It never enables the development __flots bridge in a packaged app. Normal launches do not use those variables.

Each published version is built under `release/v<package.json version>/`. `release/Flots.app` links to the newest completed build. The first release and earlier version folders are preserved. Increment package.json before publishing a new version.

Versioned releases are protected against overwrite: publishing the same version again fails with an instruction to increment package.json. Build caches live in Library/Caches rather than the project’s synchronized Documents folder.

## Verified release workflow

`npm run package` runs scripts/release.mjs. It copies the existing source into a temporary workspace under `~/Library/Caches/flots-build`, installs the exact lockfile with lifecycle scripts disabled, verifies/extracts the official Electron archive, builds the native module and UI, packages ARM64, and runs the packaged HTTPS/native-glass smoke test in an isolated profile both before and after copying to the final release directory. Only a successful build is copied into the project's versioned release folder and selected by the `release/Flots.app` shortcut. Temporary staging is deleted after success; a failed stage is retained for diagnosis.

This avoids iCloud-evicted files in Documents interrupting dependency/archive reads (observed ETIMEDOUT during this build). It does not change iCloud settings. The source of truth remains this project. Runtime/toolchain requirements are unchanged. A current graphical macOS session and network access to the smoke-test site are required.

Framework symlinks are copied verbatim. A failed early copy converted relative framework links into temporary absolute paths; that caused DYLD Library missing after staging cleanup. The release runner now preserves relative links and verifies the final destination before updating the shortcut or deleting staging.

The release runner creates a compressed DMG, verifies it with hdiutil, mounts it read-only and launches the bundled app in an isolated profile before publication. The DMG includes an Applications shortcut and installation instructions. Outputs include SHA256SUMS.txt and SBOM.cdx.json. Production dependency source archive URLs and licenses are recorded in the lockfile and inventory.

Public preview bundles receive an ad-hoc signature with hardened runtime, verified with `codesign --verify --deep --strict`. This has no Apple publisher identity and is not notarization. Ad-hoc Electron builds require JIT and the library-validation exception because no Apple Team ID is available. Camera, microphone and location entitlements permit the system consent flow; they do not bypass website or macOS permission prompts. No app-sandbox claim is made for the host process; Chromium renderer sandboxing remains enabled. See [Electron signing guidance](https://www.electronjs.org/docs/latest/tutorial/code-signing).

To keep signed resources outside iCloud-synchronized project folders, runnable local builds live in `~/Applications/Flots Builds/v<version>/Flots.app`. The versioned `release` folder contains the portable DMG, checksums and dependency inventory, plus a shortcut to that local application. `release/Flots.app` selects the newest verified build. Copy the DMG when sharing a release; local shortcuts are machine-specific. No iCloud settings or security metadata are changed.
