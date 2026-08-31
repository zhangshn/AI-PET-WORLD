import fs from "node:fs"
import path from "node:path"

import { appendAiPainterProgramEvent, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { sha256File } from "./lib/ai-painter-autonomous-closed-loop-v1.mjs"
import {
  RECOVERY_FAILURE_CODE,
  runJointConditionLocalTransportPostCheckpointRecovery,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-full-data-screen-post-checkpoint-recovery-v1.mjs"
import {
  routeJointConditionFullDataScreenTerminal,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-lifecycle-v1.mjs"
import {
  advanceCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const args = process.argv.slice(2)
const sourcePlanPath = value("--source-plan")
const sourcePlanSha256 = value("--source-plan-sha256")
const sourceTerminalPath = value("--source-terminal")
const sourceTerminalSha256 = value("--source-terminal-sha256")
if (!sourcePlanPath || !sourcePlanSha256 || !sourceTerminalPath || !sourceTerminalSha256) {
  throw new Error("source plan and source terminal paths with SHA-256 are required")
}

const projectRoot = process.cwd()
const sourcePlanAbsolute = resolveInside(projectRoot, sourcePlanPath)
if (sha256File(sourcePlanAbsolute) !== sourcePlanSha256) throw new Error("source plan SHA-256 mismatch")
const sourcePlan = JSON.parse(fs.readFileSync(sourcePlanAbsolute, "utf8"))
const recoveryId = `joint-condition-local-transport-post-checkpoint-recovery-${timestampId()}`
const outputAbsolute = resolveInside(projectRoot, sourcePlan.outputRoot)
const recoveryAbsolute = path.join(outputAbsolute, "post-training-terminal-recoveries", recoveryId)
const activeProjectionPath = resolveInside(
  projectRoot,
  ".runtime/ai-painter/current-execution-registry/active-runtime-projection.json",
)
const sourceRegistry = await readCurrentExecutionRegistry(projectRoot)
if (sourceRegistry.ok !== true) throw new Error("current execution registry is not verified")
if (sourceRegistry.registry.activeExecution !== null) throw new Error("another current execution is active")
if (sourceRegistry.registry.packageId !== sourcePlan.packageIdentity) throw new Error("source package is no longer current")
if (sourceRegistry.registry.runId !== sourcePlan.runId) throw new Error("source run is no longer current")
if (sourceRegistry.registry.taskId !== "joint_condition_local_transport_full_data_screen_terminal_recorded") {
  throw new Error("source terminal has not been projected to the current registry")
}

function project(state, adapterProgress = null) {
  writeJsonAtomic(activeProjectionPath, {
    schemaVersion: "ai-painter-current-active-runtime-projection-v1",
    authority: "local_ai_pet_world_program",
    packageIdentity: recoveryId,
    capabilityVersion: sourcePlan.capabilityVersion,
    outputRoot: sourcePlan.outputRoot,
    source: "post_checkpoint_terminal_recovery",
    state,
    phase: adapterProgress?.phase ?? inferPhase(adapterProgress?.message) ?? "validate",
    adapterProgress,
    currentRegistryAdvancePendingUntilTerminal: true,
    ownerAuthorizationRequired: false,
    ownerResponseRequired: false,
    updatedAtUtc: new Date().toISOString(),
  })
}

project("running", { phase: "validate", phasePercent: 0, message: "post_checkpoint_recovery_started" })
appendAiPainterProgramEvent({
  id: `${recoveryId}-started`,
  action: "joint_full_data_screen_post_checkpoint_recovery_started",
  runId: sourcePlan.runId,
  kind: "cpu_recovery_and_machine_review",
  status: "running",
  titleZh: "联合条件局部传输全数据筛查训练后收口恢复已开始",
  evidencePath: sourceTerminalPath,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
})

let result
try {
  result = await runJointConditionLocalTransportPostCheckpointRecovery({
    projectRoot,
    sourcePlanPath,
    sourcePlanSha256,
    sourceTerminalPath,
    sourceTerminalSha256,
    recoveryId,
    reportProgress: (progress) => project("running", progress),
  })
} catch (error) {
  fs.mkdirSync(recoveryAbsolute, { recursive: true })
  const terminalPath = path.join(recoveryAbsolute, "phase-terminal.json")
  if (!fs.existsSync(terminalPath)) {
    writeExclusive(terminalPath, {
      schemaVersion: "ai-painter-joint-full-data-screen-post-checkpoint-recovery-terminal-v1",
      executionState: "failed_closed",
      status: "post_checkpoint_recovery_program_failure",
      recoveryId,
      sourcePackageIdentity: sourcePlan.packageIdentity,
      runId: sourcePlan.runId,
      correctedSourceFailureCode: RECOVERY_FAILURE_CODE,
      failure: String(error?.stack ?? error),
      ownerAuthorizationRequired: false,
      ownerResponseRequired: false,
      trainingRestarted: false,
      gpuStarted: false,
      checkpointWeightsLoaded: false,
      recordedAtUtc: new Date().toISOString(),
    })
  }
  project("failed_closed", { phase: "recovery", phasePercent: 100, message: "post_checkpoint_recovery_program_failure" })
  appendAiPainterProgramEvent({
    id: `${recoveryId}-terminal`,
    action: "joint_full_data_screen_post_checkpoint_recovery_terminal",
    runId: sourcePlan.runId,
    kind: "cpu_recovery_and_machine_review",
    status: "failed",
    titleZh: "联合条件局部传输全数据筛查训练后收口恢复失败关闭",
    evidencePath: projectPath(projectRoot, terminalPath),
  })
  throw error
}

const finalization = result.finalizationValue
const qualified = finalization.status === "full_data_screen_qualified"
const nextTask = routeJointConditionFullDataScreenTerminal({
  status: finalization.status,
  sourcePackageIdentity: sourcePlan.packageIdentity,
  sourceRunId: sourcePlan.runId,
  sourceOutputRoot: sourcePlan.outputRoot,
})
const terminalPath = path.join(recoveryAbsolute, "phase-terminal.json")
const machineReviewPath = path.join(recoveryAbsolute, "machine-review-timeline.json")
const lateQualificationPath = path.join(recoveryAbsolute, "late-stability-qualification.json")
const resultManifestPath = path.join(recoveryAbsolute, "manifest.json")
const finalizationPath = path.join(recoveryAbsolute, "finalization", "finalization.json")
writeExclusive(terminalPath, {
  schemaVersion: "ai-painter-joint-full-data-screen-post-checkpoint-recovery-terminal-v1",
  executionState: qualified ? "completed" : "failed_closed",
  status: finalization.status,
  recoveryId,
  sourcePackageIdentity: sourcePlan.packageIdentity,
  runId: sourcePlan.runId,
  correctedSourceFailureCode: RECOVERY_FAILURE_CODE,
  recoveryEvidence: result.recoveryEvidence,
  recoveredTrainingEvidence: result.recoveredTrainingEvidence,
  machineReviewTimeline: binding(projectRoot, machineReviewPath),
  lateStabilityQualification: binding(projectRoot, lateQualificationPath),
  manifest: binding(projectRoot, resultManifestPath),
  finalization: binding(projectRoot, finalizationPath),
  reviewSummary: finalization.reviewSummary,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  trainingRestarted: false,
  gpuStarted: false,
  checkpointWeightsLoaded: false,
  stage0Started: false,
  recordedAtUtc: new Date().toISOString(),
})

const capsulePath = path.join(recoveryAbsolute, "task-capsule.json")
const registryTerminalPath = path.join(recoveryAbsolute, "registry-terminal-projection.json")
writeExclusive(registryTerminalPath, {
  schemaVersion: "ai-painter-joint-full-data-screen-post-checkpoint-recovery-registry-terminal-v1",
  executionState: "completed",
  resultExecutionState: qualified ? "completed" : "failed_closed",
  status: finalization.status,
  recoveryId,
  sourcePackageIdentity: sourcePlan.packageIdentity,
  runId: sourcePlan.runId,
  recoveryTerminal: binding(projectRoot, terminalPath),
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
  recordedAtUtc: new Date().toISOString(),
})
const evidenceFiles = [
  result.recoveryEvidence.path,
  result.recoveredTrainingEvidence.path,
  projectPath(projectRoot, machineReviewPath),
  projectPath(projectRoot, lateQualificationPath),
  projectPath(projectRoot, resultManifestPath),
  projectPath(projectRoot, finalizationPath),
  projectPath(projectRoot, terminalPath),
  projectPath(projectRoot, registryTerminalPath),
].map((relative) => resolveInside(projectRoot, relative))
writeExclusive(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${recoveryId}`,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  currentStage: { number: 4, total: 5, status: finalization.status },
  nextAllowedAction: {
    taskId: nextTask.taskId,
    action: nextTask.nextMachineAction,
    automaticRetryStarted: false,
    trainingRestartAllowed: false,
  },
  evidence: evidenceFiles.map((file) => ({
    kind: path.basename(file).replace(/\W+/gu, "_"),
    ...binding(projectRoot, file),
    sha256Verified: true,
  })),
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

appendAiPainterProgramEvent({
  id: `${recoveryId}-terminal`,
  action: "joint_full_data_screen_post_checkpoint_recovery_terminal",
  runId: sourcePlan.runId,
  kind: "cpu_recovery_and_machine_review",
  status: qualified ? "success" : "failed",
  titleZh: qualified
    ? "联合条件局部传输全数据筛查审核与终态收口完成"
    : "联合条件局部传输全数据筛查真实视觉失败关闭",
  detailZh: `固定预览审核通过 ${finalization.reviewSummary.passCount}/5，失败 ${finalization.reviewSummary.failCount}/5。`,
  evidencePath: projectPath(projectRoot, terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

const beforeAdvance = await readCurrentExecutionRegistry(projectRoot)
if (beforeAdvance.ok !== true) throw new Error("current execution registry became unverifiable")
if (beforeAdvance.registry.registryRevision !== sourceRegistry.registry.registryRevision) {
  throw new Error("current execution registry changed during recovery")
}
const terminalBinding = binding(projectRoot, registryTerminalPath)
const registry = await advanceCurrentExecutionRegistry({
  projectRoot,
  capabilityVersion: sourcePlan.capabilityVersion,
  packageId: recoveryId,
  taskId: nextTask.taskId,
  taskKind: nextTask.taskKind,
  taskGoal: nextTask.taskGoal,
  priority: nextTask.priority,
  queueStatus: nextTask.queueStatus,
  nextMachineAction: nextTask.nextMachineAction,
  runId: sourcePlan.runId,
  lifecycleStage: nextTask.lifecycleStage,
  executionState: nextTask.executionState,
  activity: nextTask.activity,
  taskCapsulePath: projectPath(projectRoot, capsulePath),
  terminalEvidencePath: terminalBinding.path,
  latestTrainingTerminal: {
    runId: sourcePlan.runId,
    ...terminalBinding,
    status: finalization.status,
    evidence: {
      sourceTrainingTerminal: binding(projectRoot, resolveInside(projectRoot, sourceTerminalPath)),
      recoveryTerminal: binding(projectRoot, terminalPath),
      recoveredTrainingEvidence: result.recoveredTrainingEvidence,
      machineReviewTimeline: binding(projectRoot, machineReviewPath),
      lateStabilityQualification: binding(projectRoot, lateQualificationPath),
      manifest: binding(projectRoot, resultManifestPath),
      finalization: binding(projectRoot, finalizationPath),
    },
  },
  expectedPreviousRegistryRevision: beforeAdvance.registry.registryRevision,
  expectedPreviousRegistrySha256: beforeAdvance.registrySha256,
})

project(qualified ? "completed" : "failed_closed", {
  phase: "finalize",
  phasePercent: 100,
  message: finalization.status,
  reviewSummary: finalization.reviewSummary,
})
process.stdout.write(`${JSON.stringify({
  status: finalization.status,
  recoveryId,
  runId: sourcePlan.runId,
  reviewSummary: finalization.reviewSummary,
  terminal: terminalBinding,
  registryRevision: registry.registry.registryRevision,
  ownerAuthorizationRequired: false,
  ownerResponseRequired: false,
}, null, 2)}\n`)

function value(name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}

function inferPhase(message) {
  if (typeof message !== "string") return null
  if (message.includes("machine_review")) return "review"
  if (message.includes("stability") || message.includes("visual_failure") || message.includes("qualified")) return "adjudicate"
  if (message.includes("final")) return "finalize"
  return null
}

function timestampId() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now).replace(/\D/gu, "")
  return `${parts}${String(now.getMilliseconds()).padStart(3, "0")}`
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

function writeExclusive(file, record) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" })
}
