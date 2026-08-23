import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "verify_bound_three_arm_design_evidence",
  "bind_owner_selected_unique_fusion_and_capacity_derivation_rules",
  "compile_inactive_materializable_three_arm_structure_contract",
  "audit_parameter_and_structural_differences",
  "execute_cpu_positive_negative_contract_regression",
  "atomically_consume_one_cpu_readonly_contract_authorization",
  "write_rules_contract_audit_owner_request_terminal_and_governance_records",
])
const DENIALS = Object.freeze([
  "modify_model_source", "implement_model_structure", "activate_contract", "modify_loss", "modify_data",
  "select_free_hyperparameters", "add_extra_layer", "add_free_channel_dimension",
  "read_or_load_checkpoint_weights", "create_optimizer", "execute_backward", "modify_model_weights",
  "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
  "reuse_historical_checkpoint", "lower_review_thresholds",
])
const EVIDENCE = Object.freeze({
  designTerminal: { path: ".runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/20260822-174537223/phase-terminal.json", sha256: "bef6e5ca6aa771923ffb418b5cef10ddc132e137b9b17a97d3b67163a08ea32e" },
  designReport: { path: ".runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/20260822-174537223/design-report.json", sha256: "4c643142f9b50c1049f282829c255eb3cf36f238e66d69da658e8eb9aaf3c9b3" },
  threeArmExperiment: { path: ".runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/20260822-174537223/controlled-experiment-contract.json", sha256: "cb2a48361f3da922e17f49cd2772f5e915f4d9df730d535a110b39e7cd1476e2" },
  evidenceIsolation: { path: ".runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/20260822-174537223/evidence-isolation-contract.json", sha256: "28a87c6e4413952d2e90c3a94ab47b0cbf2d34e001ca1bea777aa024489433a7" },
  futureQualification: { path: ".runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/20260822-174537223/future-qualification-order.json", sha256: "6080ddeb2c7fbcdda06ad4686c98b3f467da3f355dfb7150d651c6f49b4cbb6e" },
  designOwnerRequest: { path: ".runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/20260822-174537223/owner-action-request.json", sha256: "0323b84b950a37836c4d345259bf6ad425ebf1798ce73f9fa800158ad2097b2e" },
  designCpuReport: { path: ".runtime/ai-painter/stage4-bounded-controlled-model-structure-discrimination-designs/20260822-174537223/cpu-report.json", sha256: "2c9414ced9af71550eccdc961130d51a85a14aaa28cc7c3acfd8c661780e6e04" },
  activeConfig: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-145717731/active-config.json", sha256: "badf0c1cf4059423d9cdbca05773a43edd6a36f2e7efa117e986bae6ceb7bd13" },
  modelSource: { path: "ml/ai-painter/src/ai_painter/complete_world/model.py", sha256: "8b97ddb2b8ad044c526aa969e963589288d4439ac1a06198ee1024138d631dd3" },
})
const OWNER_RULES = Object.freeze({
  conditionFusionOnly: {
    changedAxis: "condition_fusion_only",
    branchCount: 1,
    resizeFunction: "resize_typed_conditions",
    inputChannels: 23,
    hiddenChannels: 64,
    outputChannels: 12,
    operators: [
      { type: "conv2d", inChannels: 23, outChannels: 64, kernelSize: 3, padding: 1, bias: true },
      { type: "silu" },
      { type: "conv2d", inChannels: 64, outChannels: 12, kernelSize: 3, padding: 1, bias: true },
    ],
    mergePoint: "predicted_velocity_final_additive_composition",
    existingInjectionPathsUnchanged: true,
    baseChannelsUnchanged: true,
    latentOutputChannelsUnchanged: true,
    freeParameterCount: 0,
  },
  capacityOnly: {
    changedAxis: "denoiser_internal_capacity_only",
    baseChannelsBefore: 64,
    baseChannelsAfter: 128,
    derivation: "existing_level1_width_equals_current_base_channels_times_2",
    derivedHierarchy: [128, 256, 512],
    timeEmbeddingChannels: 512,
    conditionFusionTopologyUnchanged: true,
    latentOutputChannels: 12,
    layerCountUnchanged: true,
    freeParameterCount: 0,
  },
  forbiddenChanges: [
    "loss", "data", "split", "condition_order", "autoencoder", "initialization_seed",
    "resolution_stages", "training_schedule", "checkpoint_format", "machine_review_thresholds",
    "historical_checkpoint_injection", "simultaneous_control_axis_change", "extra_layer",
    "free_channel_dimension",
  ],
})

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => {
  assert.equal(path.isAbsolute(value), false, `absolute_path_rejected:${value}`)
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, `project_path_required:${value}`)
  return target
}
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "new_run_id_required")
const requestId = `owner-authorized-stage4-controlled-structure-unique-derivation-rules-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: file("scripts/run-stage4-controlled-structure-unique-derivation-rules.mjs"),
  checker: file("scripts/check-stage4-controlled-structure-unique-derivation-rules.mjs"),
  contractLibrary: file("scripts/lib/ai-painter-stage4-controlled-structure-unique-derivation-rules.mjs"),
}
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-controlled-structure-unique-derivation-rules-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_readonly_stage4_controlled_structure_unique_derivation_contract",
  allowedActions: ACTIONS,
  deniedActions: DENIALS,
  sourceEvidence: EVIDENCE,
  ownerBoundRules: OWNER_RULES,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/${runId}`,
  automaticRetryAuthorized: false,
  modelSourceModificationAuthorized: false,
  architectureImplementationAuthorized: false,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))

