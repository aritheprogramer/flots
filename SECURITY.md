# Security policy

Flots is an early browser preview. The current published release is the supported preview; older binaries may contain outdated Chromium components. There is no automatic updater, so download newer releases promptly.

Remote websites run with Chromium sandboxing, context isolation, no Node integration and no privileged preload. Certificate validation is not disabled. IPC from the browser interface is validated against its sender and schema. See [implementation notes](docs/SECURITY.md).

Report vulnerabilities privately using this repository's **Security → Report a vulnerability** feature when available. Do not post session cookies, passwords, private keys or personal browser profiles in a public issue. Public issues are suitable for non-sensitive bugs and compatibility reports.

Releases are not Developer ID signed or notarized. Download only from this repository's releases and compare the provided checksums. The checksums are integrity metadata, not independent publisher authentication. Never disable macOS security protections globally to run Flots.

Security fixes need regression checks and a new release; Chromium/Electron updates must not be deferred for cosmetic work. No independent security certification is claimed.
