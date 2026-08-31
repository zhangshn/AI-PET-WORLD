import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { appendAiPainterProgramEvent, formatShanghai, projectPath } from "./lib/ai-painter-program-event-store.mjs"
import {
  createExclusiveLeafUnderFixedParent,
  routeJointConditionFullDataScreenTerminal,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-lifecycle-v1.mjs"
import { advanceCurrentExecutionRegistry, readCurrentExecutionRegistry } from "../src/server/ai-painter-current-execution-registry.mjs"

const ROOT = process.cwd()
const LEGACY_RESULT_TASKS = new Set([
  "joint_condition_local_transport_full_data_screen_terminal_recorded",
  "joint_condition_local_transport_full_data_screen_recovery_terminal_recorded",
])

const current = await readCurrentExecutionRegistry(ROOT)
assert.equal(current.ok, true, current.errorCode ?? "current registry is not verified")
assert.equal(current.registry.activeExecution, null)
assert.equal(LEGACY_RESULT_TASKS.has(current.registry.taskId), true, "current task is not an unprojected joint-condition screen result")

const latest = requireRecord(current.registry.latestTrainingTerminal, "latest training terminal missing")
const sourceRunId = requireIdentity(latest.runId, "latest training run missing")
assert.equal(sourceRunId, current.registry.runId, "current and latest training run identities differ")
const latestTerminal = readBinding(latest, "latest training terminal")
const sourceStatus = requireIdentity(latest.status, "latest training status missing")
const sourceOutputRoot = deriveSourceOutputRoot(latestTerminal.binding.path, sourceRunId)
const sourcePackageIdentity = requireIdentity(
  latestTerminal.value.sourcePackageIdentity ?? latestTerminal.value.packageIdentity ?? current.registry.packageId,
  "source package identity missing",
)
const nextTask = routeJointConditionFullDataScreenTerminal({
  status: sourceStatus,
  sourcePackageIdentity,
  sourceRunId,
  sourceOutputRoot,
})

const materializationId = `joint-condition-full-data-screen-adjudication-task-${compactUtc()}-${crypto.randomUUID().slice(0, 8)}`
const outputRoot = createExclusiveLeafUnderFixedParent({
  projectRoot: ROOT,
  parentRelative: ".runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screen-adjudication-task-materializations",
  leafIdentity: materializationId,
})
const terminalPath = path.join(outputRoot, "phase-terminal.json")
const capsulePath = path.join(outputRoot, "local-task-capsule.json")
const recordedAtUtc = new Date().toISOString()
const recordedAtAsiaShanghai = formatShanghai(recordedAtUtc)

writeExclusive(terminalPath, {
  schemaVersion: "stage4-joint-condition-full-data-screen-adjudication-task-materialization-terminal-v1",
  executionState: "completed",
  status: "joint_condition_full_data_screen_adjudication_task_materialized",
  materializationId,
  sourceRunId,
  sourcePackageIdentity,
  sourceTerminalStatus: sourceStatus,
  sourceTrainingTerminal: latestTerminal.binding,
  nextTask,
  trainingRestarted: false,
  checkpointWeightsRead: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})
writeExclusive(capsulePath, {
  schemaVersion: "ai-painter-local-task-capsule-v1",
  capsuleId: `local-ai-${materializationId}`,
  module: { id: "ai-painter-r5-stage4", nameZh: "AI Painter R5 / Stage4" },
  currentStage: { number: 4, total: 5, status: nextTask.lifecycleStage },
  nextAllowedAction: {
    taskId: nextTask.taskId,
    action: nextTask.nextMachineAction,
    automaticRetryStarted: false,
    trainingRestartAllowed: false,
  },
  evidence: [latestTerminal.binding, { ...bind(terminalPath), sha256Verified: true }],
  integrity: {
    status: "verified",
    requiredEvidencePresent: true,
    boundEvidenceVerified: true,
    identityMatches: true,
  },
  ownerAuthorizationRequired: false,
  recordedAtUtc,
  recordedAtAsiaShanghai,
})

const advanced = await advanceCurrentExecutionRegistry({
  projectRoot: ROOT,
  capabilityVersion: current.registry.capabilityVersion,
  packageId: materializationId,
  taskId: nextTask.taskId,
  taskKind: nextTask.taskKind,
  taskGoal: nextTask.taskGoal,
  priority: nextTask.priority,
  queueStatus: nextTask.queueStatus,
  nextMachineAction: nextTask.nextMachineAction,
  runId: sourceRunId,
  lifecycleStage: nextTask.lifecycleStage,
  executionState: nextTask.executionState,
  activity: nextTask.activity,
  taskCapsulePath: projectPath(capsulePath),
  terminalEvidencePath: projectPath(terminalPath),
  expectedPreviousRegistryRevision: current.registry.registryRevision,
  expectedPreviousRegistrySha256: current.registrySha256,
})

appendAiPainterProgramEvent({
  id: `joint-condition-full-data-screen-adjudication-task-${materializationId}`,
  timestamp: recordedAtUtc,
  action: "joint_condition_full_data_screen_adjudication_task_materialized",
  runId: sourceRunId,
  kind: "cpu_readonly_lifecycle_projection",
  status: "success",
  titleZh: "联合条件全数据筛选已进入失败责任边界裁决",
  evidencePath: projectPath(terminalPath),
  evidenceSha256: sha256File(terminalPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})

process.stdout.write(`${JSON.stringify({
  status: "joint_condition_full_data_screen_adjudication_task_materialized",
  materializationId,
  sourceRunId,
  taskId: nextTask.taskId,
  nextMachineAction: nextTask.nextMachineAction,
  terminal: bind(terminalPath),
  registryRevision: advanced.registry.registryRevision,
  ownerAuthorizationRequired: false,
}, null, 2)}\n`)

function deriveSourceOutputRoot(bindingPath, runId) {
  const marker = `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screens/${runId}/`
  assert.equal(bindingPath.startsWith(marker), true, "latest training terminal is outside the current full-data screen run")
  return marker.slice(0, -1)
}

function readBinding(value, role) {
  const record = requireRecord(value, `${role} binding missing`)
  const relative = normalizeRelative(requireIdentity(record.path, `${role} path missing`))
  const expectedSha256 = requireSha256(record.sha256, `${role} SHA-256 invalid`)
  const absolute = resolveInside(relative)
  assert.equal(fs.existsSync(absolute), true, `${role} file missing`)
  assert.equal(sha256File(absolute), expectedSha256, `${role} SHA-256 mismatch`)
  return { value: JSON.parse(fs.readFileSync(absolute, "utf8")), binding: { path: relative, sha256: expectedSha256, sha256Verified: true } }
}

function resolveInside(relative) {
  const normalized = normalizeRelative(relative)
  const root = path.resolve(ROOT)
  const absolute = path.resolve(root, ...normalized.split("/"))
  assert.ok(absolute.startsWith(`${root}${path.sep}`), "path escapes project")
  return absolute
}

function normalizeRelative(value) {
  const candidate = value.replaceAll("\\", "/")
  assert.equal(path.posix.isAbsolute(candidate), false, "absolute path forbidden")
  assert.equal(/^[A-Za-z]:\//u.test(candidate), false, "drive path forbidden")
  const normalized = path.posix.normalize(candidate)
  assert.equal(normalized === ".." || normalized.startsWith("../"), false, "parent path forbidden")
  return normalized
}

function requireRecord(value, message) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), message)
  return value
}

function requireIdentity(value, message) {
  assert.ok(typeof value === "string" && value.length > 0, message)
  return value
}

function requireSha256(value, message) {
  assert.match(value, /^[a-f0-9]{64}$/u, message)
  return value
}

function writeExclusive(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" })
}

function bind(file) {
  return { path: projectPath(file), sha256: sha256File(file) }
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
}

function compactUtc() {
  return new Date().toISOString().replaceAll(/[-:.TZ]/gu, "").slice(0, 17)
}
