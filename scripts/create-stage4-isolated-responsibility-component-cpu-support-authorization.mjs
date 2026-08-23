import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const DESIGN_ROOT = ".runtime/ai-painter/stage4-bounded-trainable-component-family-designs/20260823-151438887"
const SOURCE_EVIDENCE = Object.freeze({
  terminal: { path: `${DESIGN_ROOT}/phase-terminal.json`, sha256: "7e0750990ed42fee7d95ed4170015b3412f23a3458e7e8e608bac094f287b524" },
  designReport: { path: `${DESIGN_ROOT}/component-family-design-report.json`, sha256: "0f738dddd66250168035d27ad6fdc1f76ba1faa679efffdce1566653760c83fb" },
  adjudication: { path: `${DESIGN_ROOT}/adjudication.json`, sha256: "7068fe3f4106eefc660949320f53d01612bd5261735783d08932ffff4315dc13" },
  componentFamilyContract: { path: `${DESIGN_ROOT}/inactive-component-family-contract.json`, sha256: "1fa3392cc0dc39ad628ea3d50391b25858b089d0e63a55c9dbb931587a7fdc5b" },
  parameterSourceAudit: { path: `${DESIGN_ROOT}/parameter-source-audit.json`, sha256: "94402b91eaff7d9b1815213735a28f14895549abb0a0e6d503fa6d534174e5bc" },
  evidenceIsolationContract: { path: `${DESIGN_ROOT}/evidence-isolation-contract.json`, sha256: "ad61cdadcf44f46d3964f4ec9384d31d742bf6c51d68c97e67847f94d35e9db9" },
  futureQualificationSequence: { path: `${DESIGN_ROOT}/future-qualification-sequence.json`, sha256: "66f1f7b0e534e65a1bbc6e5fe3722021a9eb118b8a693704e80c9d995b0ac7da" },
  cpuReport: { path: `${DESIGN_ROOT}/cpu-report.json`, sha256: "bd1bee1aae3e588478ded54515508190d586073f73f77291a502b824f4031ee6" },
  ownerActionRequest: { path: `${DESIGN_ROOT}/owner-action-request.json`, sha256: "4b07b9d3ce1b5e806a7428d1bd3dc81cf668522d0767790588fa74cceead49ee" },
})
const STRUCTURAL_SOURCE = Object.freeze({
  path: ".runtime/ai-painter/stage4-controlled-structure-three-arm-cpu-supports/20260823-025010362/inactive-configs/baseline-current-formal-structure.inactive-config.json",
  sha256: "91308d3eba4696b7229015b3045f60b84c02cf9b45abb9b8822c40fabb763ecc",
  use: "immutable_existing_formal_topology_source_only_not_execution_identity",
})
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/u, "new_run_id_required")
const file = (value) => { assert.equal(path.isAbsolute(value), false); const target = path.resolve(ROOT, value); assert.equal(target.startsWith(`${ROOT}${path.sep}`), true); return target }
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const rel = (value) => path.relative(ROOT, value).replaceAll("\\", "/")
const bind = (value) => ({ path: rel(value), sha256: sha(value) })
for (const [name, evidence] of Object.entries(SOURCE_EVIDENCE)) {
  const target = file(evidence.path)
  assert.equal(fs.existsSync(target), true, `${name}_missing`)
  assert.equal(sha(target), evidence.sha256, `${name}_sha256_mismatch`)
}
const structuralSourcePath = file(STRUCTURAL_SOURCE.path)
assert.equal(sha(structuralSourcePath), STRUCTURAL_SOURCE.sha256, "structural_source_sha256_mismatch")
const programs = {
  runner: file("scripts/run-stage4-isolated-responsibility-component-cpu-support.mjs"),
  compiler: file("ml/ai-painter/scripts/compile_stage4_isolated_responsibility_component_inactive_configs.py"),
  checker: file("ml/ai-painter/scripts/check_stage4_isolated_responsibility_component_cpu.py"),
  modelFactory: file("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  modeRegistry: file("ml/ai-painter/scripts/ai_painter_stage_mode_registry.py"),
}
const requestId = `owner-authorized-stage4-isolated-responsibility-component-cpu-support-${runId}`
const directory = file(`.runtime/ai-painter/owner-action-requests/${requestId}`)
assert.equal(fs.existsSync(directory), false, "authorization_namespace_already_exists")
fs.mkdirSync(directory, { recursive: false })
const authorizationPath = path.join(directory, "authorization.json")
writeJsonAtomic(authorizationPath, {
  schemaVersion: "owner-authorized-stage4-isolated-responsibility-component-cpu-support-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_inactive_three_responsibility_isolated_component_implementation_only",
  allowedActions: [
    "verify_bound_component_family_design_evidence",
    "implement_strict_role_enum_and_three_parameter_isolated_cpu_inactive_components",
    "compile_three_inactive_configs",
    "execute_exact_parameter_shape_and_evidence_isolation_audit",
    "execute_cpu_positive_negative_regression",
    "atomically_consume_one_cpu_implementation_authorization",
    "write_reports_owner_request_and_governance_records",
  ],
  deniedActions: [
    "read_or_load_checkpoint_weights", "start_gpu", "create_optimizer", "backward", "modify_weights",
    "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
    "formal_inference", "checkpoint_promotion", "runtime_frame", "enter_world",
    "add_loss", "change_loss_weight", "change_data", "change_split", "change_review_thresholds",
  ],
  sourceEvidence: SOURCE_EVIDENCE,
  structuralSource: STRUCTURAL_SOURCE,
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, target]) => [name, bind(target)])),
  outputNamespace: `.runtime/ai-painter/stage4-isolated-responsibility-component-cpu-supports/${runId}`,
  oneTimeConsumption: true,
  checkpointWeightsReadAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
})
console.log(JSON.stringify({
  status: "resolved_owner_authorized_not_consumed",
  authorization: bind(authorizationPath),
  consumptionPath: rel(path.join(directory, "consumption.json")),
}, null, 2))
