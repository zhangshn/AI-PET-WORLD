import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const DESIGN_ROOT = ".runtime/ai-painter/stage4-staged-architecture-designs/20260823-145744009"
const SOURCE_EVIDENCE = Object.freeze({
  terminal: { path: `${DESIGN_ROOT}/phase-terminal.json`, sha256: "427fb0e4b6177005bddddb76f7dc01a3e4f19388e2c40ae0a46cbdd2203a26fe" },
  componentInventoryAudit: { path: `${DESIGN_ROOT}/existing-component-inventory-audit.json`, sha256: "3a97b8b86eba4f5e765735b7bb7e3fff6cc46c3427cc8b3d9d0430b44cc8e0a1" },
  architectureDesignReport: { path: `${DESIGN_ROOT}/architecture-design-report.json`, sha256: "79511b0dd2ebac9303f37279053db8e1997d16e0309ee44823198795d426a66a" },
  architectureDecision: { path: `${DESIGN_ROOT}/adjudication.json`, sha256: "b22aa28376ff7939a1b0385cdb130a80b30db2639cbdcb876775084a0a4eebcc" },
  inactiveArchitectureContract: { path: `${DESIGN_ROOT}/inactive-architecture-contract.json`, sha256: "c226612bef85c9c8b28a75ef1868ed84c8c7049e6bae1ef36a9bf49ecc514e5e" },
  cpuReport: { path: `${DESIGN_ROOT}/cpu-report.json`, sha256: "9fb9c844fe8e85e7ad39682bfc480563434b2bd76599f10b248cf7e081447008" },
  ownerActionRequest: { path: `${DESIGN_ROOT}/owner-action-request.json`, sha256: "50d11375702de04411f07fe4d1d04f773c414736c512072b42adda6998838d0c" },
})
const SUPPORTING_PATHS = Object.freeze({
  gradientInterferenceTerminal: ".runtime/ai-painter/stage4-current-model-multisample-capacity-gradient-interference-diagnostics/20260822-130905113/phase-terminal.json",
  conflictAwareStage0Terminal: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-145717731/finalization/phase-terminal.json",
  conditionFusionStage0Terminal: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-060300000-condition-fusion-stage0/finalization/phase-terminal.json",
  capacityStage0Terminal: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260823-110753367-capacity-stage0/finalization/phase-terminal.json",
  autoencoderTerminal: ".runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/20260822-125730775/phase-terminal.json",
  formalModelSource: "ml/ai-painter/src/ai_painter/complete_world/model.py",
  uniquePlan: "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
for (const [name, evidence] of Object.entries(SOURCE_EVIDENCE)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`) }
const supportingEvidence = Object.fromEntries(Object.entries(SUPPORTING_PATHS).map(([name, value]) => { const target = file(value); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(/\.(pt|pth|ckpt)$/iu.test(value), false); return [name, bind(target)] }))
const programs = { runner: file("scripts/run-stage4-bounded-trainable-component-family-design.mjs"), checker: file("scripts/check-stage4-bounded-trainable-component-family-design.mjs"), decisionLibrary: file("scripts/lib/ai-painter-stage4-bounded-trainable-component-family-design.mjs") }
const requestId = `owner-authorized-stage4-bounded-trainable-component-family-design-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, { schemaVersion: "ai-painter-owner-stage4-bounded-trainable-component-family-design-v1", status: "resolved_owner_authorized_not_consumed", requestId, commandRef: requestId, runId, scope: "one_cpu_readonly_bounded_trainable_component_family_design_only", allowedActions: ["verify_bound_staged_architecture_evidence", "compare_shared_training_failure_and_frozen_autoencoder_evidence", "design_inactive_component_family_parameter_sources_evidence_isolation_and_future_qualification_order", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_authorization", "write_reports_contracts_owner_request_and_governance_records"], deniedActions: ["implement_model", "modify_model_source", "choose_free_model_name", "choose_free_dimension", "choose_free_parameter", "add_loss", "change_loss_weight", "change_data", "change_split", "change_condition_channels", "change_autoencoder", "change_checkpoint_format", "change_review_thresholds", "read_or_load_checkpoint_weights", "start_gpu", "create_optimizer", "backward", "modify_weights", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "formal_inference", "checkpoint_promotion", "runtime_frame", "enter_world"], sourceEvidence: SOURCE_EVIDENCE, supportingEvidence, programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])), outputNamespace: `.runtime/ai-painter/stage4-bounded-trainable-component-family-designs/${runId}`, oneTimeConsumption: true, checkpointWeightsReadAuthorized: false, gpuAuthorized: false, trainingAuthorized: false })
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(directory, "consumption.json")) }, null, 2))

