import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "implement_cpu_inactive_three_arm_model_factory_support",
  "compile_three_exact_inactive_configs",
  "register_three_inactive_modes",
  "execute_cpu_positive_negative_regression",
  "audit_exact_parameter_and_tensor_shape_differences",
  "atomically_consume_one_cpu_implementation_authorization",
  "write_support_contract_reports_owner_request_terminal_and_governance_records",
])
const DENIALS = Object.freeze([
  "read_or_load_checkpoint", "create_optimizer", "execute_backward", "modify_model_weights",
  "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
  "activate_three_arm_contract", "modify_loss", "modify_data", "modify_checkpoint_format",
  "modify_machine_review_thresholds", "select_free_hyperparameter", "reuse_historical_checkpoint",
])
const EVIDENCE_ROOT = ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864"
const EVIDENCE = Object.freeze({
  terminal: { path: `${EVIDENCE_ROOT}/phase-terminal.json`, sha256: "03ee1a519ccc1495ba0cdba32e9ef512a30486e2a2f20ea8faff087edec81021" },
  uniqueDerivationRules: { path: `${EVIDENCE_ROOT}/unique-derivation-rules.json`, sha256: "decbbbb58fae07e06025731e405f2295f96194c116febedd7d13b3d3e66df183" },
  inactiveThreeArmContract: { path: `${EVIDENCE_ROOT}/inactive-three-arm-structure-contract.json`, sha256: "70fdfdf5f117b8d3d73af8a2b239fe647077d364da940b1c2fc31147497843dc" },
  parameterAudit: { path: `${EVIDENCE_ROOT}/parameter-structure-difference-audit.json`, sha256: "c0b43e616c757783cfe149a307b65ec2db2233065aeb58efad930137018b0285" },
  evidenceIsolation: { path: `${EVIDENCE_ROOT}/evidence-isolation-contract.json`, sha256: "a625595a7c3084e2e0a7e986935616614f5d155acc5b5177c8ae3948c6bd23b6" },
  ownerActionRequest: { path: `${EVIDENCE_ROOT}/owner-action-request.json`, sha256: "70bc6f01484b691a3636cc3654e0a7d7267929aa91652864e61329a04de3992a" },
  cpuReport: { path: `${EVIDENCE_ROOT}/cpu-report.json`, sha256: "1e9cdb077856b7bb88befc4d9dcdab2d4ff028dc02a64fa6f0bb1e70ac515a17" },
  sourceConfig: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-145717731/active-config.json", sha256: "badf0c1cf4059423d9cdbca05773a43edd6a36f2e7efa117e986bae6ceb7bd13" },
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
for (const [name, evidence] of Object.entries(EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const programs = {
  runner: file("scripts/run-stage4-controlled-structure-three-arm-cpu-support.mjs"),
  compiler: file("ml/ai-painter/scripts/compile_stage4_controlled_structure_three_arm_inactive_configs.py"),
  checker: file("ml/ai-painter/scripts/check_stage4_controlled_structure_three_arm_cpu.py"),
  modelFactory: file("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: file("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
}
const requestId = `owner-authorized-stage4-controlled-structure-three-arm-cpu-support-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "implementation-authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-controlled-structure-three-arm-cpu-support-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_inactive_stage4_controlled_structure_three_arm_implementation",
  allowedActions: ACTIONS,
  deniedActions: DENIALS,
  sourceEvidence: EVIDENCE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-supports/${runId}`,
  modelSourceModificationAuthorized: true,
  inactiveConfigCompilationAuthorized: true,
  checkpointWeightsReadAuthorized: false,
  optimizerAuthorized: false,
  backwardAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  automaticRetryAuthorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({
  status: "resolved_owner_authorized_not_consumed",
  authorization: bind(authorizationPath),
  consumptionPath: relative(path.join(directory, "consumption.json")),
}, null, 2))
