import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SOURCE_ROOT = ".runtime/ai-painter/stage4-generation-paradigm-reviews/20260823-142655456"
const EVIDENCE = Object.freeze({
  terminal: { path: `${SOURCE_ROOT}/phase-terminal.json`, sha256: "e15008e3490bc36b2615d6610161d98bd97abb4fc9c83556a087d4dad94bbed4" },
  audit: { path: `${SOURCE_ROOT}/generation-paradigm-audit.json`, sha256: "d79058dac254409fb838fe4073bd0e4a3977449fc396899ca050ed82ee92bb82" },
  decision: { path: `${SOURCE_ROOT}/adjudication.json`, sha256: "c645ac09e7b48143e2810698c27d28c8e62c6e2798f6ef18559489bcbcfd8938" },
  inactiveBusinessTechnicalContract: { path: `${SOURCE_ROOT}/inactive-staged-complete-map-business-technical-contract.json`, sha256: "e5297ac8fed83b084a67369cefc3dd4ab0709b16f7824f215fcb909ef8d2b084" },
  ownerActionRequest: { path: `${SOURCE_ROOT}/owner-action-request.json`, sha256: "4ce20455753772f158455ecb204d4195b842dd0d5b75a0b78928430e09f716eb" },
  cpuReport: { path: `${SOURCE_ROOT}/cpu-report.json`, sha256: "6cea6242e5c5295c4fd79da1dc013897bd490ae91c4d6a4c7756955f099fcc3a" },
})

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })

for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
  assert.equal(/\.(pt|pth|ckpt)$/iu.test(evidence.path), false, `${name}_checkpoint_read_forbidden`)
}

const requestId = `owner-authorized-stage4-staged-interface-evidence-support-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
const programs = {
  runner: file("scripts/run-stage4-staged-interface-evidence-support.mjs"),
  checker: file("scripts/check-stage4-staged-interface-evidence-support.mjs"),
  supportLibrary: file("scripts/lib/ai-painter-stage4-staged-interface-evidence-support.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "ai-painter-owner-stage4-staged-interface-evidence-support-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_inactive_staged_complete_map_interface_and_evidence_boundary_implementation_only",
  allowedActions: [
    "verify_bound_generation_paradigm_evidence",
    "implement_and_validate_four_cpu_inactive_phase_interfaces",
    "implement_and_validate_same_package_predecessor_evidence_lineage",
    "execute_cpu_positive_negative_regression_and_configuration_audit",
    "atomically_consume_one_cpu_implementation_authorization",
    "write_contracts_inactive_config_reports_owner_request_and_governance_records",
  ],
  deniedActions: [
    "define_model_name", "implement_trainable_model", "add_loss", "choose_free_parameter", "change_data", "change_split", "change_condition_channels", "change_autoencoder", "change_checkpoint_format", "change_review_thresholds", "read_or_load_checkpoint_weights", "start_gpu", "create_optimizer", "backward", "modify_weights", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "formal_inference", "checkpoint_promotion", "runtime_frame", "enter_world",
  ],
  sourceEvidence: EVIDENCE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-staged-interface-evidence-support/${runId}`,
  oneTimeConsumption: true,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(directory, "consumption.json")) }, null, 2))

