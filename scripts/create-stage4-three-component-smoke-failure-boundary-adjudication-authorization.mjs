import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const file = (value) => { assert.equal(path.isAbsolute(value), false, "absolute_path_rejected"); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_path_required"); return target }
const recovery = ".runtime/ai-painter/stage4-controlled-three-component-stage0-smoke-review-recoveries/20260824-041617238"
const smoke = ".runtime/ai-painter/stage4-controlled-three-component-stage0-smokes/owner-authorized-stage4-controlled-three-component-stage0-smoke-20260824-023500000-20260824-032425318"
const evidence = {
  previousExecutionFailureTerminal: { path: ".runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudication-failures/20260824-043107160/phase-terminal.json", sha256: "677033f1af98d4dd1fb057ea8bc808c685b89b3c1f269120e34640bc77fa5b2f" },
  previousExecutionFailureReport: { path: ".runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudication-failures/20260824-043107160/failure-report.json", sha256: "b4251c2e81983e5ad22fd168b5642367a3701252826381a38a9bd418a7d6db52" },
  previousConsumedAuthorizationRecord: { path: ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-three-component-smoke-failure-boundary-adjudication-20260824-043107160/consumption.json", sha256: "0b5ebe1c1bb41f0727865eebda2be617b2991cae2a5aa8f8ad848835d9d8b818" },
  terminal: { path: `${recovery}/phase-terminal.json`, sha256: "8f04724ac5abe095a75d61a589df060f165995299aa084c95ff85eb1e22923b5" },
  review: { path: `${recovery}/machine-review/fixed-preview-reviews.json`, sha256: "af0ff92085ea19af7f21e34f8b39cc7a2d740f6090297511ef7340404c0d0978" },
  finalization: { path: `${recovery}/finalization.json`, sha256: "779bfeabfd4d645b275c90f0cd6e0db41de50bb00998fa8cb3bd28eb9439ea9e" },
  sourceCpuReport: { path: `${recovery}/cpu-report.json`, sha256: "3c87c638fdc7ce4db079fc3cb52419e5822c9dd82430526e3910bcac68e7a84f" },
  terrainManifest: { path: `${smoke}/1-terrain-route-hydrology-spatial-realization/training-output/manifest.json`, sha256: "df3050e21894afd5cc2e5400043716f212bdeb90914a79faa4c06584127748ba" },
  objectManifest: { path: `${smoke}/2-per-class-object-semantic-realization/training-output/manifest.json`, sha256: "96a087a2fdb2e943d664e9a25708a6a691d01b5bbc00e1bd88746b4787c0b41c" },
  finalManifest: { path: `${smoke}/3-global-visual-harmonization-native-complete-rgb-decode/training-output/manifest.json`, sha256: "b76937a5f53f3a32551cb3e2626368de30bffea553bcf732ac67b1ce299b5a27" },
}
for (const item of Object.values(evidence)) { const target = file(item.path); assert.equal(fs.existsSync(target), true, `${item.path}_missing`); assert.equal(sha(target), item.sha256, `${item.path}_sha256_mismatch`) }
const programs = {
  runner: bind(file("scripts/run-stage4-three-component-smoke-failure-boundary-adjudication.mjs")),
  checker: bind(file("scripts/check-stage4-three-component-smoke-failure-boundary-adjudication.mjs")),
  decisionLibrary: bind(file("scripts/lib/ai-painter-stage4-three-component-smoke-failure-boundary-adjudication.mjs")),
}
const requestId = `owner-authorized-stage4-three-component-smoke-failure-boundary-adjudication-${runId}`
const requestRoot = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(requestRoot), false, "authorization_namespace_already_exists")
fs.mkdirSync(requestRoot, { recursive: false })
const authorizationPath = path.join(requestRoot, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-three-component-smoke-failure-boundary-adjudication-v1",
  status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId,
  scope: "one_cpu_readonly_three_component_smoke_failure_boundary_causal_adjudication",
  sourceEvidence: evidence, programLineage: programs,
  outputNamespace: `.runtime/ai-painter/stage4-three-component-smoke-failure-boundary-adjudications/${runId}`,
  allowedDecisions: ["A", "B", "C", "D"], oneTimeConsumption: true,
  checkpointWeightsReadAuthorized: false, gpuAuthorized: false, optimizerAuthorized: false, backwardAuthorized: false, trainingAuthorized: false, smokeAuthorized: false, stage0Authorized: false, stage1Authorized: false, stage2Authorized: false,
})
process.stdout.write(`${JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(requestRoot, "consumption.json")) }, null, 2)}\n`)
