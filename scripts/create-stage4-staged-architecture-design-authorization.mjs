import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const SUPPORT_ROOT = ".runtime/ai-painter/stage4-staged-interface-evidence-support/20260823-143907117"
const SOURCE_EVIDENCE = Object.freeze({
  terminal: { path: `${SUPPORT_ROOT}/phase-terminal.json`, sha256: "7fc8fd0fadc2b32988e9892087a4b05315b0ba2e96406d5fd7a446e29ab8f6d6" },
  interfaceContract: { path: `${SUPPORT_ROOT}/phase-interface-contract.json`, sha256: "d6f198eb9f29676d485789d232751ca275eb1ba699c69fc0e0d00775268ef677" },
  lineageContract: { path: `${SUPPORT_ROOT}/evidence-lineage-contract.json`, sha256: "b1984bfa69f65b0b47528d357e87612e0c01dd85aad81f34f7ea03ebab7e044f" },
  inactiveConfig: { path: `${SUPPORT_ROOT}/inactive-config.json`, sha256: "deae3185a3cdd235752a689ac54dcbeb81818739e1e7c3879e5fd1a1468358ba" },
  configurationAudit: { path: `${SUPPORT_ROOT}/configuration-audit.json`, sha256: "d0cd59488c437e67e54f54deaf098bfab3dd06d2bda066dd704a52eb671f34f4" },
  cpuReport: { path: `${SUPPORT_ROOT}/cpu-report.json`, sha256: "91c6d1932afcfa92827b5a8c45491f8f33469dc8c1aec4924228d62ec4497a22" },
  ownerActionRequest: { path: `${SUPPORT_ROOT}/owner-action-request.json`, sha256: "728e5b2384d315a63fa153b96a10107937db540a3cf38a0feaa965f659533293" },
})
const COMPONENT_PATHS = Object.freeze({
  uniquePlan: "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  formalSpec: "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  gateway: "src/world/world-visual-painter/world-visual-painter-gateway.ts",
  factManifestBuilder: "src/world/world-visual-painter/visual-fact-manifest/visual-fact-manifest-builder.ts",
  conditionBuilder: "src/world/world-visual-painter/world-generation-condition/world-generation-condition-builder.ts",
  terrainPlanBuilder: "src/world/world-visual-painter/terrain-plan/terrain-plan-builder.ts",
  internalCandidateGenerator: "src/world/world-visual-painter/internal-image-model/internal-image-candidate-generator.ts",
  completeWorldModel: "ml/ai-painter/src/ai_painter/complete_world/model.py",
  trainer: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
  structureFactRouteTerminal: ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-structure-fact-first-route-decision/20260811-193711359/phase-terminal.json",
  semanticRendererRouteTerminal: ".runtime/ai-painter/local-ai-failure-learning-r5-stage4-semantic-renderer-route-decision/20260811-235628101/phase-terminal.json",
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
for (const [name, evidence] of Object.entries(SOURCE_EVIDENCE)) { const target = file(evidence.path); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`) }
const componentEvidence = Object.fromEntries(Object.entries(COMPONENT_PATHS).map(([name, value]) => { const target = file(value); assert.equal(fs.existsSync(target), true, `${name}_missing`); assert.equal(/\.(pt|pth|ckpt)$/iu.test(value), false, `${name}_checkpoint_forbidden`); return [name, bind(target)] }))
const programs = {
  runner: file("scripts/run-stage4-staged-architecture-design.mjs"),
  checker: file("scripts/check-stage4-staged-architecture-design.mjs"),
  decisionLibrary: file("scripts/lib/ai-painter-stage4-staged-architecture-design.mjs"),
}
const requestId = `owner-authorized-stage4-staged-architecture-design-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "ai-painter-owner-stage4-staged-architecture-design-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_readonly_staged_complete_map_architecture_design_only",
  allowedActions: ["verify_bound_interface_and_lineage_evidence", "inspect_existing_project_components_and_historic_exited_routes", "execute_cpu_positive_negative_contract_regression", "atomically_consume_one_cpu_readonly_authorization", "write_problem_component_audit_architecture_design_unique_decision_contract_or_owner_request_and_governance_records"],
  deniedActions: ["define_free_model_name", "implement_trainable_model", "define_free_structure_dimension", "define_free_parameter", "change_data", "change_split", "change_condition_channels", "change_autoencoder", "change_model", "change_loss", "change_checkpoint_format", "change_review_thresholds", "read_or_load_checkpoint_weights", "start_gpu", "create_optimizer", "backward", "modify_weights", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training", "formal_inference", "checkpoint_promotion", "runtime_frame", "enter_world"],
  sourceEvidence: SOURCE_EVIDENCE,
  componentEvidence,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-staged-architecture-designs/${runId}`,
  oneTimeConsumption: true,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: rel(path.join(directory, "consumption.json")) }, null, 2))

