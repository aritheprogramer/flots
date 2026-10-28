# Memory and performance

The UI reports a discreet `MiB` indicator and a detail panel with bars: the sum of `app.getAppMetrics()` process `memory.workingSetSize`, converted from KiB by division by 1024 (technically MiB). The sum includes Electron's reported Browser/main, Tab/renderer, GPU and Utility processes, including the small browser UI renderer. The tooltip and this document explicitly identify it as a sum of resident process working sets, **not a unique attributable physical-memory total** and not JavaScript heap size.

Shared resident pages may be counted in several processes. The metric excludes processes not reported by Electron, kernel allocations and some driver/system allocations; compressed or swapped-out pages do not represent resident RAM. Apple's Activity Monitor uses different accounting, including physical footprint and compression, and may group processes differently. Numbers therefore need not agree. `privateBytes` is Windows-only in this API, so flots does not label this macOS sum as private memory. GPU resources and Chromium process reuse make a tab's marginal cost impossible to infer by simply dividing the total by the number of tabs.

The UI samples every 15 seconds while the window is visible, not minimized, and the indicator is enabled; opening the memory panel explicitly refreshes it. Process IDs are matched to page titles; a shared process lists all matching titles. Main, UI and GPU processes receive descriptive names. These are process shares, not isolated per-tab physical costs. Favorite eligibility is checked every 30 seconds, with no automatic regular-tab discard. There is no tab preloading or per-tab framework. Only the active restored destination gets a view. Hiding an inactive view retains its process; discarding removes the view, removes listeners, closes its WebContents and removes the map entry. Reclamation is asynchronous and shared Chromium processes may remain alive.

## Reproduction

Run `npm run benchmark` on an idle, plugged-in Apple Silicon Mac. It uses an isolated profile under `.test-profiles`, opens real HTTPS pages and writes `docs/benchmark-results.json`. It samples three times, five seconds apart, after five seconds settling per scenario. Each sample includes process IDs/types, resident sums, CPU snapshots and live-view count. Loading finishes before the settling delay, but page scripts and network activity may continue; this is not proof of CPU idle. C reports navigation failures instead of silently counting failed pages as successes.

A: empty new tab. B: example.com. C: example.com, Wikipedia, MDN, Electron and RFC Editor. D: nine favorite records, only the first favorite loaded, no regular tabs. E: five loaded tabs followed by four manual discards. F: restart with populated metadata and only the active destination loaded. G: 100 switches across five loaded tabs. Execution order is A, B, D, C, G, E, F so D measures the favorite-only state before opening the five regular tabs. A single short G run cannot establish absence of a leak; compare repeated controlled runs over longer periods.

No Chrome/Arc/Dia comparison or superiority claim is made. See [the validation summary](VALIDATION-SUMMARY.md) for recorded observations. Re-run under the same versions, URLs, cache/profile conditions, sample intervals, host workload and power state before treating changes as regressions.

Sources: [ProcessMetric](https://www.electronjs.org/docs/latest/api/structures/process-metric), [MemoryInfo](https://www.electronjs.org/docs/latest/api/structures/memory-info).

For v0.3.2 tab-feedback timings and memory observations, see [the validation summary](VALIDATION-SUMMARY.md). No cross-version RAM reduction is claimed.
