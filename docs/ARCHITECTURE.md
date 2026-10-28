# Architecture — Flots V3

Actual host: Apple Silicon arm64, macOS 27.0 (26A5353q), Node 24.8.0, Xcode Command Line Tools.

| Choice | Practical assessment |
| --- | --- |
| Electron + WebContentsView | Selected. Prebuilt ARM64 Chromium, maintained security updates, isolated sandboxed site renderers, native menus/downloads, straightforward CLI-only local packaging. Framework and UI-renderer overhead is unavoidable; real memory is measured, not predicted. CPU depends primarily on website workloads and Chromium. |
| CEF + native shell | Chromium and native integration are feasible, potentially less UI overhead, but substantial Objective-C++ integration, CEF binary/toolchain compatibility and browser plumbing. macOS 27 validation and distribution are additional work. No demonstrated resource advantage for this implementation. |
| Qt WebEngine | Chromium-based, but adds Qt, toolchain and licensing/distribution considerations. No demonstrated advantage on this 8 GB development machine. |
| WKWebView reference | Native WebKit could reduce embedding complexity; excluded because Chromium is a product requirement. |

One BrowserWindow hosts a small local TypeScript UI. Site content lives in WebContentsViews with no Node access or privileged preload. Only the active view is attached; inactive loaded tabs retain navigation state. Favorites and tabs share one destination model. Views are created on demand and explicitly closed on discard. A single persistent Chromium partition retains cookies independently of view lifetime. JSON metadata uses debounced serialized atomic replacement.

Vite builds the UI; esbuild bundles main and the isolated local preload. No React, extension system or full Chromium checkout is needed. A small original Objective-C++ Node-API module compiles against AppKit to place native NSGlassEffectView regions behind the top chrome and sidebar. It has no renderer-facing API, subprocess or third-party native dependency. This is a public preview. Compatibility is limited to the tests described in [the validation summary](VALIDATION-SUMMARY.md).

Electron's current stable version is pinned in the lockfile. Public previews use manual updates and regression tests. Developer ID signing, notarization, an independent hardened-runtime review and a secure automatic updater are not yet provided. CEF would also require regular Chromium security upgrades; embedding never delegates that responsibility to the OS.

Sources: [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [Electron release schedule](https://releases.electronjs.org/schedule), [code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing).

## V3 extensions

Layout and appearance settings persist in the existing profile schema with validated defaults. Switching layouts only changes native view bounds; pages retain the same WebContents and JavaScript state. Semantic accent tokens separate readable action/focus colors from the selected Dock tint. Runtime Dock images use the original wave alpha mask and a bounded eight-color image cache. Finder retains the bundled ICNS.

Memory process IDs are attributed to live page titles without pretending each tab owns a separate process. The indicator and downloads remain inside the second toolbar row. Native background glass never intercepts input and is removed before window destruction. All web rendering and security boundaries remain in the existing Electron architecture.
