import {defineConfig} from '@playwright/test'
import path from 'node:path'

const baseURL = process.env.AI_PET_WORLD_E2E_BASE_URL?.trim()
if (!baseURL) throw new Error('Set AI_PET_WORLD_E2E_BASE_URL to the local test server; configuration alone is not E2E success.')
const url = new URL(baseURL)
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
  throw new Error('E2E is restricted to a local HTTP test server.')
}
const output = path.resolve(process.env.AI_PET_WORLD_E2E_OUTPUT_ROOT ??
  `.runtime/e2e/${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`)
export default defineConfig({
  testDir: './scripts/e2e', fullyParallel: false, workers: 1, retries: 0,
  timeout: 60000, expect: {timeout: 15000}, outputDir: path.join(output, 'artifacts'),
  reporter: [['list'], ['json', {outputFile: path.join(output, 'results.json')}]],
  use: {baseURL, browserName: 'chromium', headless: true,
    ...(process.env.AI_PET_WORLD_E2E_CHANNEL ? {channel: process.env.AI_PET_WORLD_E2E_CHANNEL} : {}),
    screenshot: 'only-on-failure', trace: 'retain-on-failure'},
  ...(process.env.AI_PET_WORLD_E2E_START_SERVER === '1' ? {webServer: {
    command: `npm run dev -- --port ${Number(url.port || 80)}`, url: baseURL,
    ...(process.env.AI_PET_WORLD_E2E_WORKSPACE ? {
      cwd: path.resolve(process.env.AI_PET_WORLD_E2E_WORKSPACE),
      env: {AI_PET_WORLD_DATA_ROOT: path.resolve(process.env.AI_PET_WORLD_E2E_WORKSPACE, '.ai-pet-world-data')},
    } : {}),
    reuseExistingServer: false, timeout: 120000,
  }} : {}),
})
