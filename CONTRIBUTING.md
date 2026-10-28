# Contributing

Start with a reproducible issue and a small change. Avoid adding frameworks or background services unless their benefit justifies the memory cost.

Use Node 24+ and `npm ci`. Run `npm run typecheck` and `npm test`. Browser changes also require the relevant macOS integration checks in the README. Use isolated profiles; never test against someone's real accounts or browse their profile data.

Keep remote content sandboxed, validate IPC, preserve native accessibility, honor reduced motion and do not bypass certificate errors. Record exactly what was tested and distinguish simulated authentication or device tests from real hardware validation.

Releases are versioned. Do not overwrite a published version, silently change the user-data path, or publish debug/test profiles. Keep known limitations and third-party licenses current.
