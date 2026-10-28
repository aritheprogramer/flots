# Validation — v0.3.3

Test host: Apple M1, 8 GB unified memory, macOS 27.0 (26A5353q), Node 24.8.0, Electron 45.0.0. These results apply to this configuration and do not certify every Mac or website.

| Suite | Result | Scope |
| --- | --- | --- |
| npm audit (production and development) | 0 known vulnerabilities | Registry audit at release validation time; not a security certification |
| Strict TypeScript build | Passed | Main, preload, renderer and shared code |
| Unit tests | 17 passed | Navigation, validated actions, state and appearance |
| Runtime integration | 24 checks passed | Tabs, favorites, sessions, permissions, IPC and lifecycle |
| Storage restart | 14 checks passed | Persistent cookies, localStorage, IndexedDB, CacheStorage and HTTP cache; session-only data not retained |
| WebAuthn | 10 checks passed | Virtual authenticator and account selection; not iCloud or hardware keys |
| Interaction | 8 checks passed | Keyboard, menus and focus behavior |
| Everyday compatibility | 14 checks passed | External links, forms, file input, page save, PDF generation, print dispatch and concurrency |
| Visual regression | 15 reference images | Both layouts, light/dark appearance, blue/rose accents, settings and memory panel |

Tests use isolated profiles. No test logs into a personal account. Persistent-cookie verification does not establish that Google or another service will preserve every real login: the service can expire or revoke it. The print command is dispatched to Chromium and PDF output is verified; no physical printer was used. Inline PDF URL navigation is checked; complete PDF viewer interaction is not certified.

Native window screenshots in this repository show the running app with a real public MDN page. They are not decorative browser mockups. The native glass is behind the browser chrome and does not intercept its controls. Full spoken VoiceOver testing remains outstanding.

## Memory and responsiveness

The previous controlled v0.3.2 run measured median tab feedback near 32 ms versus 98 ms in v0.3.1. A two-page scenario reported roughly 550 MiB of summed resident process memory. These are short, host-specific observations, not guarantees or claims of lower RAM than another browser. The v0.3.3 design adds no frontend framework or background process. See [the measurement method](PERFORMANCE.md).

Only the active page is created on session restore. Regular inactive tabs are retained; manual discard removes their WebContents. Automatic favorite discard protects active, audio, download and capture destinations and conservatively protects possible form input. Longer real-workload endurance testing is still needed.

## Release checks

The release workflow verifies the official Electron archive checksum, builds ARM64, launches the packaged app with an isolated profile, verifies the DMG filesystem, launches the app from its read-only mounted DMG, and repeats the smoke test at the final release path. A successful release includes SHA256SUMS.txt and a production npm dependency inventory. The bundle has a verified ad-hoc signature and hardened runtime. It is not Developer ID signed or notarized.

See [compatibility](COMPATIBILITY.md) and [security](../SECURITY.md) for remaining limitations.
