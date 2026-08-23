import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_bound_condition_fusion_stage0_and_cross_arm_evidence",
  "execute_cpu_positive_negative_causal_regression",
  "atomically_consume_one_cpu_readonly_final_route_authorization",
  "record_condition_fusion_route_exit_and_capacity_only_route",
  "activate_existing_capacity_arm_in_formal_stage_contract",
  "compile_one_unsigned_stage0_stage1_stage2_continuation_plan",
  "write_offline_signing_command_and_governance_postmortem",
  "synchronize_unique_plan_capsule_event_ledger_and_sqlite",
])
const DENIALS = Object.freeze([
  "read_owner_private_key", "sign_continuation_package", "read_or_load_checkpoint_weights",
  "start_gpu", "create_optimizer", "execute_backward", "modify_model_weights", "start_smoke",
  "start_stage0", "start_stage1", "start_stage2", "start_training", "automatic_retry",
  "reuse_historical_checkpoint", "reuse_historical_authorization", "reuse_output_directory",
  "add_loss", "add_candidate", "change_data", "change_split", "change_review_thresholds",
])
const EVIDENCE = Object.freeze({
  stage0Terminal: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0/finalization/phase-terminal.json", sha256: "e3457170d3f2879ab89fb376518d4590c3f40ee7d27d8c3fa2e30171b2c7fef4" },
  stage0Manifest: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0/training-output/manifest.json", sha256: "d733bb8949a7c12bb2e3f98d9ef1b89d49c189e262a9b4ae4ff2032d7c4e8bba" },
  stage0Review: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0/training-output/fixed-preview-reviews.json", sha256: "2e15b3dcc0b8d023823d103b13aa459dbb35870f4883a70df49307ba73f0375a" },
  stage0Telemetry: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0/resource-telemetry.json", sha256: "0268216785b3a73d3d168431ae59edea34e5eac1716a13618c92c9b22e863782" },
  activeConfig: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0/active-config.json", sha256: "3796b3406a7efc9f2b65621aaaf95ceddd0f0080e250ec40dbc6545296a8f304" },
  crossArmTerminal: { path: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/phase-terminal.json", sha256: "010771f7555e29043aee5dda7b142c820ef7d2a1ff0d55ea2a4bdea928cd4391" },
  crossArmReport: { path: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/cross-arm-comparison-report.json", sha256: "9ce5de9674a55f40da17b2fe791d6d90482f51f732c7638e69c1a267f6d6a7e7" },
  crossArmDecision: { path: ".runtime/ai-painter/stage4-controlled-structure-cross-arm-adjudications/20260823-055500000/cross-arm-adjudication.json", sha256: "adf504f93eef3646fcfa66bdba45108e97c115beeede488d5bae7d1c2b489337" },
  formalCpuReport: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-stage-mode-cpu-regressions/20260823-060200000/cpu-report.json", sha256: "b29f891b7a18cd6412beec83b2f916cc03f106dea244b44142248b5d72db65d3" },
  priorOwnerRequest: { path: ".runtime/ai-painter/owner-action-requests/owner-action-request-stage4-condition-fusion-stage0-visual-failure-adjudication-20260823-080700000/request.json", sha256: "9c92135c5b8693548ae5d15df5fd855641a1ab948f3f4c451a0ac60a57f7b616" },
  capacityConfig: { path: ".runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-supports/20260823-025010362/inactive-configs/capacity-only-base-width-64-to-existing-level1-128.inactive-config.json", sha256: "3465bed7c9b01e71196b972e4831bdef7d09bc7c13fe6b4cc19c779df56d717f" },
  capacityQualification: { path: ".runtime/ai-painter/stage4-terminal-pass-late-convergence-qualifications/20260823-054700004/phase-terminal.json", sha256: "44348242e2e659c0010914041431a15503b231b1a87b1b889bd55d80f6040d18" },
})
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }

const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const requestId = `owner-authorized-stage4-condition-fusion-stage0-final-route-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
const programs = {
  runner: file("scripts/run-stage4-condition-fusion-stage0-final-route.mjs"),
  checker: file("scripts/check-stage4-condition-fusion-stage0-final-route-adjudication.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-condition-fusion-stage0-final-route-adjudication.mjs"),
  continuationAuditor: file("scripts/check-ai-painter-stage4-stage0-to-80-continuation-plan.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "ai-painter-owner-stage4-condition-fusion-stage0-final-route-and-capacity-continuation-v1",
  status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId,
  scope: "cpu_readonly_condition_fusion_stage0_final_route_adjudication_capacity_formal_activation_and_unsigned_continuation_plan_compilation",
  allowedActions: ACTIONS, deniedActions: DENIALS, sourceEvidence: EVIDENCE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-condition-fusion-stage0-final-route-adjudications/${runId}`,
  planCompilationNamespace: `.runtime/ai-painter/stage4-stage0-to-80-continuation-plan-compilations/${runId}`,
  oneTimeConsumption: true, automaticRetryAuthorized: false, checkpointWeightsReadAuthorized: false,
  ownerPrivateKeyReadAuthorized: false, gpuAuthorized: false, trainingAuthorized: false,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(directory, "consumption.json")) }, null, 2))
