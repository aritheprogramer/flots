# Compatibility and reliability

Flots is a public preview for Apple Silicon Macs, tested on macOS 27. The goal is a reliable everyday browser; this document records evidence rather than promising every website will work.

| Area | Evidence / status |
| --- | --- |
| HTTP/HTTPS and search | Automated real HTTPS and local fixture navigation |
| Tabs, favorites, restore, layouts | Automated model and Electron integration checks |
| Login persistence | Local server recognizes a persistent HttpOnly login after immediate quit/relaunch; logout remains effective |
| Website storage | localStorage, IndexedDB, Cache Storage, HTTP cache and service worker registration checked across restart |
| Forms and file uploads | Form submission and native page file-input attachment tested with fixtures |
| External links | OS URL events route HTTP/HTTPS into tabs; invalid protocols are rejected |
| Downloads | Real completion, progress and file contents tested |
| Save Page | Actual HTMLComplete output checked |
| Printing / PDF | Chromium PDF generation and Print action routing checked; physical printer not tested |
| Inline PDF | Successful navigation checked; comprehensive PDF reader interactions not certified |
| iCloud passkeys | Not available in this build |
| Other WebAuthn | Virtual CTAP2 creation/signature verification/account selection tested; physical keys not certified |
| Google/other real accounts | User-specific accounts not accessed or certified; some popup/opener flows may fail |
| DRM video | No Widevine integration; do not expect Netflix-like services to work |
| Camera, microphone, conferencing | Permission policy exists; actual devices and sites need broader testing |
| Extensions / password autofill | Not implemented |
| Accessibility | Keyboard, accessible names, focus and reduced-motion tests; full spoken VoiceOver audit incomplete |
| Memory | Lazy view creation and cleanup tested; metrics count shared pages more than once; no claim of lower RAM than competing browsers |
| Updates | Manual GitHub releases; no automatic updater |
| Distribution | Free non-notarized DMG; per-app approval may be needed; managed Macs may prevent installation |

The published installer is tested by mounting it read-only and launching its bundled application in an isolated profile. Build success is not a guarantee of website compatibility. Keep another browser available for unsupported workflows.
