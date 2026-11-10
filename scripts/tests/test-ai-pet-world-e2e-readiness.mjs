import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import test from "node:test"

const script = fileURLToPath(new URL("../check-ai-pet-world-e2e-readiness.mjs", import.meta.url))
const pkg = JSON.parse(fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"))

function run(baseUrl, args = []) {
  const env = { ...process.env }
  delete env.AI_PET_WORLD_E2E_BASE_URL
  if (baseUrl !== undefined) env.AI_PET_WORLD_E2E_BASE_URL = baseUrl
  // Deliberately outside the repo: local route lookup must not depend on cwd.
  const child = spawnSync(process.execPath, [script, ...args], {
    cwd: os.tmpdir(), env, encoding: "utf8", timeout: 5000,
  })
  assert.ifError(child.error)
  assert.equal(child.signal, null)
  assert.equal(child.stderr, "")
  const result = JSON.parse(child.stdout)
  assert.equal(result.testsExecuted, 0)
  assert.equal(result.e2ePassed, false)
  assert.equal(result.browserSuiteImplemented, true)
  return { status: child.status, result }
}

test("package separates configuration preflight from the E2E entry", () => {
  assert.equal(pkg.scripts["check:e2e-config"], "node scripts/check-ai-pet-world-e2e-readiness.mjs")
  assert.equal(pkg.scripts["test:e2e"], "playwright test")
})

for (const baseUrl of [undefined, "   ", "not-a-url", "file:///tmp/world"]) {
  test(`preflight rejects missing or invalid URL: ${JSON.stringify(baseUrl)}`, () => {
    const { status, result } = run(baseUrl)
    assert.equal(status, 2)
    assert.equal(result.code, "E2E_CONFIGURATION_INVALID")
    assert.equal(result.configurationReady, false)
  })
}

test("valid URL passes configuration only, without contacting a server", () => {
  const { status, result } = run(" http://127.0.0.1:1 ")
  assert.equal(status, 0)
  assert.equal(result.status, "configuration_ready")
  assert.equal(result.checkKind, "e2e_configuration_only")
  assert.equal(result.appRouteExists, true)
  assert.equal(result.browserBaseUrl, "http://127.0.0.1:1")
})

for (const baseUrl of [undefined, "http://127.0.0.1:1"]) {
  test(`suite preflight never reports executed browser tests: ${JSON.stringify(baseUrl)}`, () => {
    const { status, result } = run(baseUrl, ["--require-suite"])
    assert.equal(status, baseUrl ? 0 : 2)
    assert.equal(result.status, baseUrl ? "configuration_ready" : "blocked")
    assert.equal(result.code, baseUrl ? null : "E2E_CONFIGURATION_INVALID")
  })
}
