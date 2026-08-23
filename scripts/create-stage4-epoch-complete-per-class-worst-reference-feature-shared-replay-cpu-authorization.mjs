import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const index = process.argv.indexOf("--run-id")
const runId = index >= 0 ? process.argv[index + 1] : null
assert.match(runId ?? "", /^\d{8}-\d{9}$/)

const requestId = `owner-authorized-stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-${runId}`
const root = path.join(ROOT, ".runtime", "ai-painter", "owner-action-requests", requestId)
const authorizationPath = path.join(root, "implementation-authorization.json")
const consumptionPath = path.join(root, "implementation-consumption.json")
const outputNamespace = `.runtime/ai-painter/stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementations/${runId}`
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const bind = (relativePath, expectedSha256) => {
  const file = path.resolve(ROOT, relativePath)
  assert.equal(fs.existsSync(file), true, `missing_source:${relativePath}`)
  assert.equal(sha256(file), expectedSha256, `source_sha256_mismatch:${relativePath}`)
  return { path: relativePath.replaceAll("\\", "/"), sha256: expectedSha256 }
}

const sourceEvidence = {
  terminal: bind(".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071517942/phase-terminal.json", "c489842ee9e3c11f6b16f108a740e4ed7f11bf02569a170fc264c892e335ed13"),
  designReport: bind(".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071517942/supervision-design-report.json", "7055d987ed0350994f973ede746d957ee3af78e8498ed6fda6687f407c4a7aa8"),
  decision: bind(".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071517942/adjudication.json", "6a253fa55e96dfe97f44ca0122f36896b7c993721fc91867b4c5eaed4abbac15"),
  inactiveTrainingObjectiveContract: bind(".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071517942/inactive-training-objective-contract.json", "aa22e17d80b5103d2682cebe395e45b546aa18fb132faf3a318dedc8c8779d81"),
  dataSupervisionAudit: bind(".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071517942/data-supervision-audit.json", "e7c0a704d6a80074f2614ce82ab3f57119fb62344aca64888a29b41194c50338"),
  supervisionCoverageAudit: bind(".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071517942/supervision-coverage-audit.json", "16e7a1bf4022e0a1ce94399ce43a4d15c19739727ebfa81e10000cf8f99b92ff"),
  cpuReport: bind(".runtime/ai-painter/stage4-three-class-supervision-identifiability-reviews/20260822-071517942/cpu-report.json", "a82574a7dfffce00c9aa2b8f95e67667061a573dba500bc24507d0b79899516f"),
  priorInactiveConfig: bind(".runtime/ai-painter/stage4-epoch-complete-per-class-worst-luminance-cpu-implementations/20260821-092701121/inactive-config.json", "2945c28e537f417437a3164c32625967882b3c06774a7407d60499c7b3aaf53a"),
}

assert.equal(fs.existsSync(root), false, "authorization_namespace_exists")
assert.equal(fs.existsSync(path.resolve(ROOT, outputNamespace)), false, "output_namespace_exists")
fs.mkdirSync(root, { recursive: false })
const authorization = {
  schemaVersion: "owner-authorized-stage4-epoch-complete-per-class-worst-reference-feature-shared-replay-cpu-implementation-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_cpu_inactive_stage4_epoch_complete_per_class_worst_reference_feature_selection_and_shared_replay_implementation",
  contractId: "stage4_epoch_complete_per_class_worst_sample_reference_feature_structure_selection_and_shared_replay_v1",
  allowedActions: [
    "verify_bound_identifiability_evidence",
    "extend_existing_trainer_shared_epoch_complete_selection",
    "extend_inactive_config_compiler_and_support_contract",
    "extend_cpu_positive_negative_checker",
    "execute_cpu_regression_and_configuration_audit",
    "write_local_program_records",
  ],
  deniedActions: [
    "read_or_load_checkpoint", "create_optimizer", "execute_backward", "modify_model_weights",
    "start_gpu", "start_smoke", "start_stage0", "start_stage1", "start_stage2", "start_training",
    "add_optimizer_steps", "change_loss_weights", "change_dataset_or_split", "change_review_thresholds",
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
try { fs.writeFileSync(fd, `${JSON.stringify(authorization, null, 2)}\n`, "utf8"); fs.fsyncSync(fd) }
finally { fs.closeSync(fd) }
console.log(JSON.stringify({
  status: authorization.status,
  authorization: { path: path.relative(ROOT, authorizationPath).replaceAll("\\", "/"), sha256: sha256(authorizationPath) },
  consumptionPath: path.relative(ROOT, consumptionPath).replaceAll("\\", "/"),
  outputNamespace,
}, null, 2))
