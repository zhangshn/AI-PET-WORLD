import fs from "node:fs"

// A configured URL is not a browser harness or a completed E2E test.
const requireSuite = process.argv.includes("--require-suite")
const browserBaseUrl = process.env.AI_PET_WORLD_E2E_BASE_URL?.trim() || null
let validBaseUrl = false
try {
  const url = new URL(browserBaseUrl)
  validBaseUrl = ["http:", "https:"].includes(url.protocol)
} catch {
  // Missing or malformed configuration is reported below, without network I/O.
}
const appRouteExists = fs.existsSync(new URL("../src/app/world/page.tsx", import.meta.url))
const configurationReady = validBaseUrl && appRouteExists
const browserSuiteImplemented = fs.existsSync(new URL('../playwright.config.mjs', import.meta.url))
  && fs.existsSync(new URL('./e2e/local-readonly.spec.mjs', import.meta.url))
const passed = configurationReady && (!requireSuite || browserSuiteImplemented)
const result = {
  checkKind: requireSuite ? "e2e_suite_availability" : "e2e_configuration_only",
  status: passed ? "configuration_ready" : "blocked",
  code: !configurationReady ? "E2E_CONFIGURATION_INVALID" : requireSuite && !browserSuiteImplemented ? "E2E_SUITE_NOT_IMPLEMENTED" : null,
  reason: requireSuite
    ? "Browser suite availability and URL configuration checked only; run test:e2e for actual browser execution."
    : passed
      ? "URL syntax and local route existence checked only; server reachability and browser behavior were not tested."
      : "A valid HTTP(S) base URL and the local world route are required for configuration preflight.",
  browserBaseUrl,
  appRouteExists,
  configurationReady,
  browserSuiteImplemented,
  testsExecuted: 0,
  e2ePassed: false,
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (!passed) process.exitCode = 2
