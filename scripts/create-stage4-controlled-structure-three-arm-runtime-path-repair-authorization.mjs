import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const ACTIONS = Object.freeze([
  "fix_registered_runtime_logical_physical_path_contract_in_compiler_checker_and_runner",
  "compile_three_exact_inactive_configs",
  "execute_cpu_positive_negative_regression",
  "audit_exact_parameter_and_tensor_shape_differences",
  "atomically_consume_one_cpu_implementation_authorization",
  "write_support_contract_reports_owner_request_terminal_and_governance_records",
])
const DENIALS = Object.freeze([
  "modify_model_source", "modify_mode_registry",
  "read_or_load_checkpoint", "create_optimizer", "execute_backward", "modify_model_weights",
  "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
  "activate_three_arm_contract", "modify_loss", "modify_data", "modify_checkpoint_format",
  "modify_machine_review_thresholds", "select_free_hyperparameter", "reuse_historical_checkpoint",
])
const AUTHORIZED_STARTING_LINEAGE = Object.freeze({
  compilerSha256: "322866e4ec7396059f37f9afd0601c0aa1843fb44a39c63dd47ebc84ea0bfdfa",
  checkerSha256: "6b7686d5e7fec36d02787ef4a23a6586f2bac9f5c1509efc9cd69f630ad5fa30",
  runnerSha256: "083beb72709a62be87193183cb6c158c6111023247ea8edff2cb9330543029a9",
  frozenModelFactorySha256: "6af8503ed89c49a470fc64767287a66e3c46c877587f0c14f1b7847ad116aeb5",
  frozenModeRegistrySha256: "ac7aa0ff10ae9dff0959cfd030314d70ed80c481d7093f1bfe336a59a1d8ea03",
})
const EVIDENCE = Object.freeze({
  failureTerminal: { path: ".runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-support-failures/20260823-024340722/phase-terminal.json", sha256: "b805e20d1777485bcda74003d854a3a2b14495435a963624e775cfc35cb31025" },
  failureReport: { path: ".runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-support-failures/20260823-024340722/failure-report.json", sha256: "aacba9041dabf2f1e782dbe463f411f14c2cdce9cafdc87b348a03e63e3cc499" },
  closedUnconsumedAuthorization: { path: ".runtime/ai-painter/owner-action-requests/owner-authorized-stage4-controlled-structure-three-arm-cpu-support-20260823-024340722/implementation-authorization.json", sha256: "7f6950930cef828c166dbb1b9c632fe927f5670146990b2cc5ec00b4b8c9708c" },
  terminal: { path: ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864/phase-terminal.json", sha256: "03ee1a519ccc1495ba0cdba32e9ef512a30486e2a2f20ea8faff087edec81021" },
  uniqueDerivationRules: { path: ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864/unique-derivation-rules.json", sha256: "decbbbb58fae07e06025731e405f2295f96194c116febedd7d13b3d3e66df183" },
  inactiveThreeArmContract: { path: ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864/inactive-three-arm-structure-contract.json", sha256: "70fdfdf5f117b8d3d73af8a2b239fe647077d364da940b1c2fc31147497843dc" },
  parameterAudit: { path: ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864/parameter-structure-difference-audit.json", sha256: "c0b43e616c757783cfe149a307b65ec2db2233065aeb58efad930137018b0285" },
  evidenceIsolation: { path: ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864/evidence-isolation-contract.json", sha256: "a625595a7c3084e2e0a7e986935616614f5d155acc5b5177c8ae3948c6bd23b6" },
  ownerActionRequest: { path: ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864/owner-action-request.json", sha256: "70bc6f01484b691a3636cc3654e0a7d7267929aa91652864e61329a04de3992a" },
  cpuReport: { path: ".runtime/ai-painter/stage4-controlled-structure-unique-derivation-rules/20260823-023120864/cpu-report.json", sha256: "1e9cdb077856b7bb88befc4d9dcdab2d4ff028dc02a64fa6f0bb1e70ac515a17" },
  sourceConfig: { path: ".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-145717731/active-config.json", sha256: "badf0c1cf4059423d9cdbca05773a43edd6a36f2e7efa117e986bae6ceb7bd13" },
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const file = (value) => {
  assert.equal(path.isAbsolute(value), false, "project_relative_path_required")
  const target = path.resolve(ROOT, value)
  assert.equal(target.startsWith(`${ROOT}${path.sep}`), true, "project_path_required")
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
assert.equal(fs.existsSync(path.join(path.dirname(file(EVIDENCE.closedUnconsumedAuthorization.path)), "consumption.json")), false, "closed_authorization_must_remain_unconsumed")
const programs = {
  runner: file("scripts/run-stage4-controlled-structure-three-arm-cpu-support.mjs"),
  compiler: file("ml/ai-painter/scripts/compile_stage4_controlled_structure_three_arm_inactive_configs.py"),
  checker: file("ml/ai-painter/scripts/check_stage4_controlled_structure_three_arm_cpu.py"),
  modelFactory: file("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: file("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
}
assert.equal(sha(programs.modelFactory), AUTHORIZED_STARTING_LINEAGE.frozenModelFactorySha256, "frozen_model_factory_changed")
assert.equal(sha(programs.modeRegistry), AUTHORIZED_STARTING_LINEAGE.frozenModeRegistrySha256, "frozen_mode_registry_changed")
const requestId = `owner-authorized-stage4-controlled-structure-three-arm-runtime-path-repair-${runId}`
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
  authorizedStartingLineage: AUTHORIZED_STARTING_LINEAGE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-supports/${runId}`,
  modelSourceModificationAuthorized: false,
  inactiveConfigCompilationAuthorized: true,
  checkpointWeightsReadAuthorized: false,
  optimizerAuthorized: false,
  backwardAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  automaticRetryAuthorized: false,
  oneTimeConsumption: true,
})
console.log(JSON.stringify({ status: "resolved_owner_authorized_not_consumed", authorization: bind(authorizationPath), consumptionPath: relative(path.join(directory, "consumption.json")) }, null, 2))
