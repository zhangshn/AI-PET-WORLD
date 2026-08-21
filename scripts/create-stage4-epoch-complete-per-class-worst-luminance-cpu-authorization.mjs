import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const runId = process.argv[process.argv.indexOf("--run-id") + 1]
assert.match(runId ?? "", /^\d{8}-\d{9}$/)

const requestId = `owner-authorized-stage4-epoch-complete-per-class-worst-luminance-cpu-${runId}`
const authorizationRoot = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", requestId)
const authorizationPath = path.join(authorizationRoot, "implementation-authorization.json")
const consumptionPath = path.join(authorizationRoot, "implementation-consumption.json")
const outputNamespace = `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/${runId}`

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const bind = (relativePath, expectedSha256) => {
  const file = path.resolve(ROOT, relativePath)
  assert.equal(fs.existsSync(file), true, `missing_source:${relativePath}`)
  const actual = sha256(file)
  assert.equal(actual, expectedSha256, `source_sha256_mismatch:${relativePath}`)
  return { path: relativePath.replaceAll("\\", "/"), sha256: actual }
}

const sourceEvidence = {
  causalTerminal: bind(
    ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-causal-adjudications/20260821-090907108/phase-terminal.json",
    "e1c65ace0033a65dd64ab40579ac1b9298cea6253e925fa286a7170fecc200f5",
  ),
  causalReport: bind(
    ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-causal-adjudications/20260821-090907108/causal-analysis-report.json",
    "15315a214731fe09da279afdf076bdb9ae1bb31feaef922a5df8c53c4352605e",
  ),
  causalDecision: bind(
    ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-causal-adjudications/20260821-090907108/adjudication.json",
    "25bc7e138da75fc4fb1a4e453558423eeca6c294c865802078c70531c92ca9dd",
  ),
  inactiveRepairContract: bind(
    ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-causal-adjudications/20260821-090907108/inactive-repair-contract.json",
    "b64ca468422eb47054d7b09649c9284e3b4231be0fec3ea4c868b7a36ba26729",
  ),
  causalCpuReport: bind(
    ".runtime/ai-painter/stage4-stage0-three-object-reference-semantic-causal-adjudications/20260821-090907108/cpu-report.json",
    "5162a728595dd3880ea4c5fdd733678c26b21f82a464676969e2355ba27af9e7",
  ),
  priorInactiveConfig: bind(
    ".runtime/ai-painter/stage4-per-class-worst-sample-final-visible-luminance-structure-smoke-entry-integrations/20260821-062434926/inactive-smoke-config.json",
    "586c5c79f8436df985a995f567a5e9de7df8c39973efb3a15d43fad175c7cd1b",
  ),
}

assert.equal(fs.existsSync(authorizationRoot), false, "authorization_namespace_exists")
assert.equal(fs.existsSync(path.resolve(ROOT, outputNamespace)), false, "output_namespace_exists")
fs.mkdirSync(authorizationRoot, { recursive: false })
const authorization = {
  schemaVersion: "owner-authorized-stage4-epoch-complete-per-class-worst-luminance-cpu-implementation-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_inactive_stage4_epoch_complete_per_class_worst_luminance_selection_and_checkpoint_identity_implementation",
  contractId: "stage4_epoch_complete_per_class_worst_sample_final_visible_luminance_selection_and_checkpoint_identity_v1",
  allowedActions: [
    "verify_bound_causal_terminal_report_decision_contract_and_cpu_report",
    "extend_existing_trainer_with_epoch_complete_per_class_selection_identity",
    "extend_inactive_configuration_compiler_and_support_contract",
    "extend_cpu_positive_negative_contract_checker",
    "execute_python_syntax_cpu_regression_and_configuration_audit",
    "write_support_contract_cpu_report_owner_request_terminal_and_local_records",
  ],
  deniedActions: [
    "read_or_load_checkpoint", "create_optimizer", "execute_backward", "modify_model_weights",
    "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
    "change_model_architecture", "change_existing_loss_weights", "change_dataset_or_split",
    "change_checkpoint_format", "change_machine_review_thresholds", "use_failed_preview_as_target",
    "use_review_result_as_target", "add_optimizer_steps", "select_free_hyperparameters",
  ],
  sourceEvidence,
  implementationPreimage: {
    trainer: {
      path: "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py",
      sha256: sha256(path.join(ROOT, "ml/ai-painter/scripts/train_ai_assisted_conditional_denoiser.py")),
    },
  },
  outputNamespace,
  checkpointReadAuthorized: false,
  optimizerCreationAuthorized: false,
  backwardExecutionAuthorized: false,
  modelWeightModificationAuthorized: false,
  gpuAuthorized: false,
  trainingAuthorized: false,
  oneTimeConsumptionRequired: true,
  automaticRetryAuthorized: false,
  createdAtUtc: new Date().toISOString(),
}
const fd = fs.openSync(authorizationPath, "wx")
try {
  fs.writeFileSync(fd, `${JSON.stringify(authorization, null, 2)}\n`, "utf8")
  fs.fsyncSync(fd)
} finally {
  fs.closeSync(fd)
}
console.log(JSON.stringify({
  status: authorization.status,
  authorization: {
    path: path.relative(ROOT, authorizationPath).replaceAll("\\", "/"),
    sha256: sha256(authorizationPath),
  },
  consumptionPath: path.relative(ROOT, consumptionPath).replaceAll("\\", "/"),
  outputNamespace,
}, null, 2))
