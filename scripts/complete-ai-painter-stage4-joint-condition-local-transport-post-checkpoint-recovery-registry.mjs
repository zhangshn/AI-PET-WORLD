import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { appendAiPainterProgramEvent, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { sha256File } from "./lib/ai-painter-autonomous-closed-loop-v1.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const args = process.argv.slice(2)
const recoveryRoot = value("--recovery-root")
if (!recoveryRoot) throw new Error("--recovery-root is required")
const projectRoot = process.cwd()
const recoveryAbsolute = resolveInside(projectRoot, recoveryRoot)
assert.ok(
  recoveryRoot.includes("/stage4-joint-condition-local-transport-full-data-screens/") &&
    recoveryRoot.includes("/post-training-terminal-recoveries/"),
  "recovery root is outside the formal recovery namespace",
)

const sourceTerminalPath = path.join(recoveryAbsolute, "phase-terminal.json")
const finalizationPath = path.join(recoveryAbsolute, "finalization", "finalization.json")
const reviewPath = path.join(recoveryAbsolute, "machine-review-timeline.json")
const latePath = path.join(recoveryAbsolute, "late-stability-qualification.json")
const resultManifestPath = path.join(recoveryAbsolute, "manifest.json")
const recoveryEvidencePath = path.join(recoveryAbsolute, "post-checkpoint-recovery-evidence.json")
const recoveredTrainingPath = path.join(recoveryAbsolute, "recovered-trainer-evidence.json")
const sourceCapsulePath = path.join(recoveryAbsolute, "task-capsule.json")
for (const file of [sourceTerminalPath, finalizationPath, reviewPath, latePath, resultManifestPath, recoveryEvidencePath, recoveredTrainingPath, sourceCapsulePath]) {
  assert.equal(fs.existsSync(file), true, `required recovery artifact is absent: ${projectPath(projectRoot, file)}`)
}

const terminal = readJson(sourceTerminalPath)
const finalization = readJson(finalizationPath)
const review = readJson(reviewPath)
const late = readJson(latePath)
assert.equal(terminal.schemaVersion, "ai-painter-joint-full-data-screen-post-checkpoint-recovery-terminal-v1")
assert.equal(terminal.status, finalization.status)
assert.equal(terminal.runId, finalization.runId)
assert.deepEqual(terminal.reviewSummary, finalization.reviewSummary)
assert.equal(review.completedReviewCount, 5)
assert.equal(review.previewPassCount + review.previewFailCount, 5)
assert.equal(late.runId, terminal.runId)
verifyBound(projectRoot, terminal.recoveryEvidence)
verifyBound(projectRoot, terminal.recoveredTrainingEvidence)
verifyBound(projectRoot, terminal.machineReviewTimeline)
verifyBound(projectRoot, terminal.lateStabilityQualification)
verifyBound(projectRoot, terminal.manifest)
verifyBound(projectRoot, terminal.finalization)

const sourceRegistry = await readCurrentExecutionRegistry(projectRoot)
if (sourceRegistry.ok !== true) throw new Error("current execution registry is not verified")
assert.equal(sourceRegistry.registry.activeExecution, null)
assert.equal(sourceRegistry.registry.runId, terminal.runId)
assert.equal(sourceRegistry.registry.taskId, "joint_condition_local_transport_full_data_screen_terminal_recorded")

const registryTerminalPath = path.join(recoveryAbsolute, "registry-terminal-projection.json")
writeExclusive(registryTerminalPath, {
  schemaVersion: "ai-painter-joint-full-data-screen-post-checkpoint-recovery-registry-terminal-v1",
  executionState: "completed",
  resultExecutionState: terminal.executionState,
  status: terminal.status,
  recoveryId: terminal.recoveryId,
  sourcePackageIdentity: terminal.sourcePackageIdentity,
  runId: terminal.runId,
  recoveryTerminal: binding(projectRoot, sourceTerminalPath),
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  recordedAtUtc: new Date().toISOString(),
})

const capsulePath = path.join(recoveryAbsolute, "registry-task-capsule.json")
writeExclusive(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${terminal.recoveryId}-registry-projection`,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  currentStage: { number: 4, total: 5, status: terminal.status },
  evidence: [
    ["sourceRecoveryCapsule", sourceCapsulePath],
    ["recoveryTerminal", sourceTerminalPath],
    ["registryTerminal", registryTerminalPath],
    ["machineReviewTimeline", reviewPath],
    ["lateStabilityQualification", latePath],
    ["finalization", finalizationPath],
  ].map(([kind, file]) => ({ kind, ...binding(projectRoot, file), sha256Verified: true })),
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  recordedAtUtc: new Date().toISOString(),
})

const registryTerminal = binding(projectRoot, registryTerminalPath)
const registry = await advanceCurrentExecutionRegistry({
  projectRoot,
  capabilityVersion: sourceRegistry.registry.capabilityVersion,
  packageId: terminal.recoveryId,
  taskId: "joint_condition_local_transport_full_data_screen_recovery_terminal_recorded",
  taskKind: "post_checkpoint_recovery_result",
  runId: terminal.runId,
  lifecycleStage: terminal.status,
  executionState: "completed",
  activity: terminal.status,
  taskCapsulePath: projectPath(projectRoot, capsulePath),
  terminalEvidencePath: registryTerminal.path,
  latestTrainingTerminal: {
    runId: terminal.runId,
    ...registryTerminal,
    status: terminal.status,
    evidence: {
      recoveryTerminal: binding(projectRoot, sourceTerminalPath),
      recoveredTrainingEvidence: binding(projectRoot, recoveredTrainingPath),
      machineReviewTimeline: binding(projectRoot, reviewPath),
      lateStabilityQualification: binding(projectRoot, latePath),
      manifest: binding(projectRoot, resultManifestPath),
      finalization: binding(projectRoot, finalizationPath),
    },
  },
  expectedPreviousRegistryRevision: sourceRegistry.registry.registryRevision,
  expectedPreviousRegistrySha256: sourceRegistry.registrySha256,
})

appendAiPainterProgramEvent({
  id: `${terminal.recoveryId}-registry-projected`,
  action: "joint_full_data_screen_post_checkpoint_recovery_registry_projected",
  runId: terminal.runId,
  kind: "cpu_recovery_and_machine_review",
  status: terminal.status === "full_data_screen_qualified" ? "success" : "failed",
  titleZh: "联合条件局部传输全数据筛查审核终态已同步",
  detailZh: `固定预览审核通过 ${review.previewPassCount}/5，失败 ${review.previewFailCount}/5。`,
  evidencePath: registryTerminal.path,
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

writeJsonAtomic(
  resolveInside(projectRoot, ".runtime/ai-painter/current-execution-registry/active-runtime-projection.json"),
  {
    schemaVersion: "ai-painter-current-active-runtime-projection-v1",
    authority: "local_ai_pet_world_program",
    packageIdentity: terminal.recoveryId,
    capabilityVersion: sourceRegistry.registry.capabilityVersion,
    outputRoot: recoveryRoot.split("/post-training-terminal-recoveries/")[0],
    source: "post_checkpoint_terminal_recovery_registry_projection",
    state: terminal.executionState,
    phase: "finalize",
    adapterProgress: {
      phasePercent: 100,
      message: terminal.status,
      reviewSummary: terminal.reviewSummary,
    },
    currentRegistryAdvancePendingUntilTerminal: false,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    updatedAtUtc: new Date().toISOString(),
  },
)

process.stdout.write(`${JSON.stringify({
  status: terminal.status,
  recoveryId: terminal.recoveryId,
  reviewSummary: terminal.reviewSummary,
  registryRevision: registry.registry.registryRevision,
  terminal: registryTerminal,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
}, null, 2)}\n`)

function value(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

function verifyBound(root, item) {
  assert.match(item?.sha256 ?? "", /^[a-f0-9]{64}$/u)
  assert.equal(sha256File(resolveInside(root, item.path)), item.sha256)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function resolveInside(root, relative) {
  if (path.isAbsolute(relative) || /^[A-Za-z]:[\\/]/u.test(relative) || relative.includes("..")) {
    throw new Error("path must be project-relative")
  }
  const base = path.resolve(root)
  const target = path.resolve(base, relative)
  if (!target.startsWith(`${base}${path.sep}`)) throw new Error("path escapes project")
  return target
}

function projectPath(root, absolute) {
  return path.relative(path.resolve(root), absolute).replaceAll("\\", "/")
}

function binding(root, absolute) {
  return { path: projectPath(root, absolute), sha256: sha256File(absolute) }
}

function writeExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
}
