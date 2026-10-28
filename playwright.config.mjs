import { defineConfig } from 'playwright/test';
export default defineConfig({ testDir: './tests', testMatch: 'v3.spec.mjs', workers: 1, timeout: 180000, expect: { timeout: 10000, toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled', caret: 'hide' } }, reporter: [['list'], ['json', { outputFile: 'docs/v3-test-results.json' }]], outputDir: '.test-profiles/visual-results' });
