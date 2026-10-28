# Security model and release limitations

All website content is untrusted. Site WebContentsViews explicitly enable sandboxing, context isolation and web security, disable Node integration and insecure mixed content, and have no preload or application bridge. Chromium's site isolation and GPU defaults are preserved. The app calls `app.enableSandbox()` before readiness. No certificate-error bypass is installed; invalid certificates fail closed.

The trusted local UI has a narrow contextBridge API, a CSP without inline scripts/eval, no Node access, no webviews, no popup creation, and blocked top-level navigation. Every privileged IPC handler validates the WebContents identity, exact main-frame identity and exact local UI URL. Actions are allowlisted and input-validated; download actions resolve known IDs instead of accepting filesystem paths. Website strings are escaped before insertion into UI markup. Remote favicons are images only and use no-referrer, but retrieving them still contacts their host.

Navigation accepts HTTP(S) without embedded credentials. JavaScript, file, data and arbitrary custom schemes cannot enter the address bar's navigation path. Mail and telephone links may open an OS handler only after an explicit native prompt. Other custom protocols are unsupported. Window-open requests become controlled tabs; no website-created privileged BrowserWindow is allowed. Cross-window JavaScript opener relationships, popup POST bodies and some OAuth popup flows are not reproduced. New tabs opened in the background remain unloaded until selected. Dragging a link onto browser chrome opens a tab; dragging a link into the website viewport is disabled.

Permission requests are denied by default. HTTPS main-origin camera/microphone, geolocation and notifications can request consent in a native dialog; grants apply only to that WebContents/origin and only for the running session. Requests must still belong to the active page when consent returns. Media grants conservatively protect the page from discarding for its lifetime. Display capture, filesystem APIs, USB, HID, Bluetooth, MIDI, local-network permissions and unknown permissions are denied. macOS may independently require OS consent; camera/microphone/geolocation hardware flows have not been certified. Cross-origin embedded-frame permissions are intentionally limited.

Automatic discard applies only to inactive favorites. Audio, loading, downloads, media grants and possible typed input prevent discard. Before discarding, every inspectable frame is checked for forms, inputs, selects, textareas and contenteditable nodes. Any such node or inspection failure prevents discard. This deliberately overprotects pages. Arbitrary web applications, canvas editors and script-maintained state cannot be perfectly detected; users can disable automatic discarding (delay 0). Manual discard is explicit and refuses known unsafe states. Discard restores only URL/title/favicon metadata; JavaScript, scroll state, forms and full back/forward history are lost. Closing pages with known input/capture activity asks for confirmation; downloads keep their source page alive until completion/cancellation.

Metadata uses mode-0600 files and serialized, debounced atomic rename in the profile directory. Corrupt JSON is preserved with a timestamped suffix and a fresh profile is created. Atomic replacement prevents partial JSON reads; sudden power loss before the OS flushes filesystem buffers can still lose a recent write. URLs and browsing history are plaintext local metadata, as in many browsers; cookies and password values are never copied into that JSON. A persistent Chromium session manages cookies and authentication. The app does not promise that every service will keep the user signed in.

## Passwords and Keychain

No custom password database or autofill system is implemented. Keychain (or Electron safeStorage) can protect an individual secret, but does not supply secure origin matching, phishing-resistant autofill, form heuristics, credential lifecycle, trusted UI or Chrome's password-manager integration. Electron does not expose Chrome's complete password manager as a supported embedding API. Browser cookies use Chromium's supported persistence; this is distinct from saving passwords. Do not treat this app as a replacement for a mature password manager.

## Network blocker

One unmodified Ghostery FiltersEngine instance runs in the main process and handles the persistent profile's requests. The bundled original MIT starter rules cover a small set of common third-party advertising/analytics domains. Main-frame navigation is never blocked. A global setting and exact-host exceptions are supported. No cosmetic filtering, scriptlets, CNAME uncloaking, comprehensive regional subscriptions or uBlock Origin parity is claimed. Rules are updated with reviewed application releases; no remote rules are fetched at runtime. Engine: MPL-2.0, retain notices and make applicable source available. The starter list is reviewed with releases; coverage is intentionally limited.

## Requirements for a mature release

This is a development preview, not a security-audited general-purpose browser release. The bundle uses ad-hoc signing with hardened runtime, JIT and the library-validation exception required by ad-hoc Electron. This does not authenticate a publisher or provide notarization. Chromium renderer sandboxing remains enabled.

The public preview has the limitations below; a mature general-purpose release still requires:

- Keep Electron on a currently supported stable branch; regularly run `npm audit`, update the lockfile, and rerun security/runtime tests. A clean audit alone does not prove security.
- Perform independent review of IPC, navigation, permissions, untrusted UI strings, download handling, popup flows and lifecycle races.
- Add a signed update mechanism and publish a Chromium security-response policy.
- Sign all executable components with a Developer ID Application identity, validate hardened-runtime entitlements, submit to Apple notarization and staple the ticket. Obtain real Apple Developer credentials separately.
- Verify macOS 27 release compatibility, accessibility, common sign-in flows, camera/microphone consent and long-running resource use on real machines.
- Preserve Electron/Chromium and dependency licenses, and audit packaged artifacts.

Sources: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [permissions](https://www.electronjs.org/docs/latest/api/session), [Ghostery engine source](https://github.com/ghostery/adblocker).

## V3 review

The native glass bridge accepts only a main-process window handle and bounded geometry, is never exposed through preload/IPC, uses public AppKit API, and is unloaded with the window. No Chromium security flag changed. A self-signed HTTPS fixture is rejected with ERR_CERT_AUTHORITY_INVALID in the V3 integration suite. The packaged smoke test explicitly verifies that the development-only __flots object is absent. Permissions lose their in-memory grants when their WebContents is destroyed.
