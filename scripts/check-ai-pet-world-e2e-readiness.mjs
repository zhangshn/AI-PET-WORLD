import fs from "node:fs"

const hasBrowserHarness = Boolean(process.env.AI_PET_WORLD_E2E_BASE_URL)
const result = {
  status: hasBrowserHarness ? "ready" : "blocked",
  code: hasBrowserHarness ? null : "E2E_TEST_BLOCKED",
  reason: hasBrowserHarness
    ? "An external browser harness is configured; run the browser suite against the supplied base URL."
    : "No browser harness is configured in this checkout; no E2E result is claimed.",
  browserBaseUrl: process.env.AI_PET_WORLD_E2E_BASE_URL ?? null,
  appRouteExists: fs.existsSync("src/app/world/page.tsx"),
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (!hasBrowserHarness) process.exitCode = 2
