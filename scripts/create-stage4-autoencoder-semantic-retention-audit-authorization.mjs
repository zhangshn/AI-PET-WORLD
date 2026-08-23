import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1] }
const runId = arg("--run-id")
assert.match(runId ?? "", /^\d{8}-\d{9}$/, "fresh_run_id_required")
const absolute = (value) => path.resolve(ROOT, value)
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const bind = (value) => ({ path: relative(value), sha256: sha(value) })

const sources = {
  rootConvergenceTerminal: absolute(".runtime/ai-painter/stage4-model-training-paradigm-root-convergences/20260822-123905189/phase-terminal.json"),
  rootAnalysis: absolute(".runtime/ai-painter/stage4-model-training-paradigm-root-convergences/20260822-123905189/model-training-paradigm-root-analysis.json"),
  rootDecision: absolute(".runtime/ai-painter/stage4-model-training-paradigm-root-convergences/20260822-123905189/adjudication.json"),
  ownerEvidenceRequest: absolute(".runtime/ai-painter/stage4-model-training-paradigm-root-convergences/20260822-123905189/owner-evidence-request.json"),
  sourceIndex: absolute("data/world-samples/ai-assisted-cold-start-dataset-packages/natural-home-ai-assisted-cold-start-mvp-natural-home-v0.3-2026-08-02T01-38-05-149Z/source-index.json"),
  activeConfig: absolute(".runtime/ai-painter/stage4-semantic-mixture-formal-training/20260822-094629682/active-config.json"),
  modelSource: absolute("ml/ai-painter/src/ai_painter/complete_world/model.py"),
  conditionAlignmentContract: absolute("scripts/lib/ai-assisted-condition-alignment.mjs"),
}
const expected = {
  rootConvergenceTerminal: "28f4400c970f55ddbb92f1a49b634248ffa4bebe37fb3880cde1f27a8565804c",
  rootAnalysis: "27d20070835a17f6518e3694f5e834105aac7bff16471648eacf9b600d9e51a9",
  rootDecision: "fc8e00ec88b481e8ddd766ff9cab11c2d78094646f0bcd1ef18f7ba587c6efba",
  ownerEvidenceRequest: "2fb6d221601f59e62c0c19df5ae5a586d7d65e044b624c11d59b5bd8a5629f5b",
  sourceIndex: "84f1d4c810e9023f3517f9fd6567dfc2414a0eb95a0a56df45a3025344e12251",
  activeConfig: "22a8455d0ad2115d2157c9c90f2c71a5f64ced8bd1a967d502484bae7fe60d75",
  modelSource: "8b97ddb2b8ad044c526aa969e963589288d4439ac1a06198ee1024138d631dd3",
  conditionAlignmentContract: "c01ea4efba9835e488e42c7ed44d2aef434ee3db21b06e84e70379722bcc145e",
}
for (const [name, value] of Object.entries(sources)) {
  assert.equal(fs.existsSync(value), true, `${name}_missing`)
  assert.equal(sha(value), expected[name], `${name}_sha256_mismatch`)
}

const programs = {
  runner: absolute("scripts/run-stage4-autoencoder-semantic-retention-audit.mjs"),
  checker: absolute("scripts/check-stage4-autoencoder-semantic-retention-audit.mjs"),
  decisionLibrary: absolute("scripts/lib/ai-painter-stage4-autoencoder-semantic-retention-audit.mjs"),
  gpuRunner: absolute("ml/ai-painter/scripts/run_stage4_frozen_autoencoder_semantic_retention_audit.py"),
}
for (const value of Object.values(programs)) assert.equal(fs.existsSync(value), true, `program_missing:${relative(value)}`)

const requestId = `owner-authorized-stage4-frozen-autoencoder-semantic-retention-audit-${runId}`
const authorizationPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/authorization.json`)
const consumptionPath = absolute(`.runtime/ai-painter/owner-action-requests/${requestId}/gpu-consumption.json`)
const outputNamespace = `.runtime/ai-painter/stage4-frozen-autoencoder-semantic-retention-audits/${runId}`
assert.equal(fs.existsSync(authorizationPath), false, "authorization_already_exists")
assert.equal(fs.existsSync(consumptionPath), false, "consumption_already_exists")
assert.equal(fs.existsSync(absolute(outputNamespace)), false, "output_namespace_already_exists")

const checkpointPath = ".runtime/ai-painter/project-owned-complete-world-model-ai-assisted-v2/ai-assisted-complete-world-training-v2-2026-07-15T00-36-47-418Z/complete-world-ai-assisted-autoencoder.pt"
assert.equal(fs.existsSync(absolute(checkpointPath)), true, "autoencoder_checkpoint_missing_without_content_read")
const authorization = {
  schemaVersion: "owner-authorized-stage4-frozen-autoencoder-semantic-retention-audit-v1",
  status: "resolved_owner_authorized_not_consumed",
  requestId,
  commandRef: requestId,
  runId,
  scope: "one_readonly_gpu_frozen_autoencoder_semantic_retention_audit_across_64",
  allowedActions: ["verify_bound_evidence", "execute_cpu_positive_negative_contract_regression", "execute_python_cuda_disk_preflight", "atomically_consume_one_readonly_gpu_authorization", "read_and_freeze_project_autoencoder_checkpoint", "audit_all_64_approved_reference_rgb_encode_decode", "write_metrics_cuda_telemetry_state_hashes_decision_and_governance_records"],
  deniedActions: ["read_denoiser_checkpoint", "read_failed_checkpoint", "modify_data", "modify_model", "modify_weights", "create_optimizer", "execute_backward", "write_checkpoint", "start_smoke", "start_training", "change_review_thresholds", "use_failed_preview_or_review_as_training_target"],
  bindings: {
    ...Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, bind(value)])),
    projectAutoencoderCheckpoint: { path: checkpointPath, sha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba" },
  },
  programLineage: Object.fromEntries(Object.entries(programs).map(([name, value]) => [name, bind(value)])),
  taskIdentity: {
    approvedRecordCount: 64,
    splitCounts: { train: 48, validation: 8, challenge: 4, regression: 4 },
    objectClasses: ["footprints", "tree", "rock", "vegetation"],
    sourceIndexPath: relative(sources.sourceIndex),
    configPath: relative(sources.activeConfig),
    configSha256: expected.activeConfig,
    autoencoderCheckpointPath: checkpointPath,
    autoencoderCheckpointSha256: "5867e9ea29b61f1dd59e835bdb4ace3afaeea3ca234eed82bab2f7790e5e43ba",
  },
  execution: { outputDirectory: outputNamespace, consumptionPath: relative(consumptionPath) },
  oneTimeConsumption: true,
  gpuAuthorized: true,
  checkpointWeightsReadAuthorized: true,
  optimizerAuthorized: false,
  backwardAuthorized: false,
  trainingAuthorized: false,
}
writeJsonAtomic(authorizationPath, authorization)
console.log(JSON.stringify({ status: "authorization_materialized", authorization: bind(authorizationPath), consumptionPath: relative(consumptionPath), outputNamespace }, null, 2))
