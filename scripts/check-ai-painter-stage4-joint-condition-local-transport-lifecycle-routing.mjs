import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  FORMAL_STAGE_VALIDATION_COMPLETED,
  JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_COMMAND,
  JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_TASK,
  createExclusiveLeafUnderFixedParent,
  routeJointConditionFullDataScreenTerminal,
} from "./lib/ai-painter-stage4-joint-condition-local-transport-lifecycle-v1.mjs"

const ROOT = process.cwd()
const runId = "20260830-022124154-joint-condition-local-transport-full-data-screen"
const route = routeJointConditionFullDataScreenTerminal({
  status: "full_data_screen_real_visual_failure",
  sourcePackageIdentity: "joint-condition-local-transport-full-data-screen-fixture",
  sourceRunId: runId,
  sourceOutputRoot: `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screens/${runId}`,
})
assert.equal(route.taskId, JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_TASK)
assert.equal(route.nextMachineAction, JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_COMMAND)
assert.equal(route.lifecycleStage, FORMAL_STAGE_VALIDATION_COMPLETED)
assert.equal(route.executionState, "package_materialized")
assert.equal(route.queueStatus, "ready")
assert.equal(route.automaticRetryStarted, false)
assert.equal(route.trainingRestartAllowed, false)

const namespaceFixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-stage4-lifecycle-"))
try {
  const firstLeaf = createExclusiveLeafUnderFixedParent({
    projectRoot: namespaceFixtureRoot,
    parentRelative: ".runtime/ai-painter/fixed-parent",
    leafIdentity: "fresh-leaf",
  })
  assert.equal(fs.existsSync(firstLeaf), true)
  assert.throws(() => createExclusiveLeafUnderFixedParent({
    projectRoot: namespaceFixtureRoot,
    parentRelative: ".runtime/ai-painter/fixed-parent",
    leafIdentity: "fresh-leaf",
  }), /EEXIST/u)
  assert.throws(() => createExclusiveLeafUnderFixedParent({
    projectRoot: namespaceFixtureRoot,
    parentRelative: ".runtime/ai-painter/fixed-parent",
    leafIdentity: "../escape",
  }), /leaf_identity_escapes_parent/u)
} finally {
  const resolvedFixture = path.resolve(namespaceFixtureRoot)
  assert.equal(resolvedFixture.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`), true)
  fs.rmSync(resolvedFixture, { recursive: true, force: true })
}

for (const mutate of [
  (input) => { input.sourceRunId = "foreign-run" },
  (input) => { input.sourceOutputRoot = `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screens/foreign-run` },
  (input) => { input.sourceOutputRoot = `../stage4-joint-condition-local-transport-full-data-screens/${runId}` },
  (input) => { input.sourceOutputRoot = `.runtime/ai-painter/stage4-other-full-data-screens/${runId}` },
]) {
  const input = {
    status: "full_data_screen_real_visual_failure",
    sourcePackageIdentity: "fixture-package",
    sourceRunId: runId,
    sourceOutputRoot: `.runtime/ai-painter/stage4-joint-condition-local-transport-full-data-screens/${runId}`,
  }
  mutate(input)
  assert.throws(() => routeJointConditionFullDataScreenTerminal(input))
}

const runnerSource = read("scripts/run-ai-painter-stage4-joint-condition-local-transport-full-data-screen-package.mjs")
const recoverySource = read("scripts/run-ai-painter-stage4-joint-condition-local-transport-full-data-screen-post-checkpoint-recovery.mjs")
const materializerSource = read("scripts/materialize-ai-painter-stage4-joint-condition-local-transport-full-data-screen-adjudication-task.mjs")
const adjudicatorSource = read("scripts/adjudicate-ai-painter-stage4-joint-condition-local-transport-full-data-screen-failure-boundary.mjs")
const registrySource = read("src/server/ai-painter-current-execution-registry.mjs")
const projectionSource = read("src/server/ai-console/ai-painter-current-execution-projection.ts")
for (const source of [runnerSource, recoverySource]) {
  assert.match(source, /routeJointConditionFullDataScreenTerminal/u)
  assert.match(source, /taskGoal: nextTask\.taskGoal/u)
  assert.match(source, /nextMachineAction: nextTask\.nextMachineAction/u)
  assert.doesNotMatch(source, /lifecycleStage: (?:status|finalization\.status)/u)
}
assert.match(materializerSource, /cross-run|identities differ/u)
assert.match(materializerSource, /LEGACY_RESULT_TASKS/u)
assert.match(materializerSource, /trainingRestarted: false/u)
assert.match(adjudicatorSource, /cross-run machine review is forbidden/u)
assert.match(adjudicatorSource, /automaticTrainingContinuationAllowed: false/u)
assert.match(adjudicatorSource, /successorDisposition: "change_candidate_not_yet_qualified"/u)
assert.match(adjudicatorSource, /createExclusiveLeafUnderFixedParent/u)
assert.doesNotMatch(adjudicatorSource, /mkdirSync\(outputRoot, \{ recursive: false \}\)/u)
for (const field of ["taskGoal", "priority", "queueStatus", "nextMachineAction", "queuedAtUtc"]) {
  assert.match(registrySource, new RegExp(`${field}: taskControl\\.${field}`, "u"))
}
assert.doesNotMatch(projectionSource, /nextMachineAction:\s*null/u)
assert.match(projectionSource, /nextMachineAction: task\.nextMachineAction/u)
assert.match(projectionSource, /dataStatus: unavailableFields\.length === 0 \? "connected" : "partial"/u)

const entryRegistry = JSON.parse(read("data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json"))
const byScript = new Map(entryRegistry.currentEntrypoints.map((entry) => [entry.packageScript, entry]))
const retiredBinding = entryRegistry.retiredEntrypointIndex
assert.match(retiredBinding?.sha256 ?? "", /^[a-f0-9]{64}$/u)
assert.equal(retiredBinding.dispatchable, false)
const retiredIndexSource = read(retiredBinding.path)
assert.equal(sha256(retiredIndexSource), retiredBinding.sha256)
const retiredIndex = JSON.parse(retiredIndexSource)
assert.equal(retiredIndex.status, "active_read_only_audit_index")
assert.equal(retiredIndex.dispatchable, false)
assert.equal(retiredIndex.resolverMaySchedule, false)
const retiredByScript = new Map(retiredIndex.retiredEntrypoints.map((entry) => [entry.packageScript, entry]))
for (const packageScript of [
  "verify:ai-painter-stage4-full-resolution-typed-semantic-transport-rgb-responsibility-cpu-contract",
  "run:ai-painter-stage4-v2-cpu-contract-acceptance",
  "plan:ai-painter-stage4-v2-readonly-gpu-qualification",
  "check:ai-painter-stage4-core",
]) {
  assert.equal(byScript.has(packageScript), true, `current entry missing: ${packageScript}`)
  assert.equal(fs.existsSync(path.join(ROOT, byScript.get(packageScript).entryFile)), true)
  assert.equal(retiredByScript.has(packageScript), false, `current entry also appears retired: ${packageScript}`)
}
for (const packageScript of [
  JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_COMMAND,
  "check:ai-painter-stage4-joint-condition-local-transport-lifecycle-routing",
  "check:ai-painter-stage4-joint-condition-local-transport-full-data-screen",
  "compile:ai-painter-stage4-joint-condition-local-transport-full-data-screen",
  "materialize:ai-painter-stage4-joint-condition-local-transport-full-data-screen",
  "run:ai-painter-stage4-joint-condition-local-transport-full-data-screen",
  "launch:ai-painter-stage4-joint-condition-local-transport-full-data-screen-background",
  "recover:ai-painter-stage4-joint-condition-local-transport-post-checkpoint",
  "materialize:ai-painter-stage4-joint-condition-local-transport-full-data-screen-adjudication-task",
]) {
  assert.equal(byScript.has(packageScript), false, `retired entry remains schedulable: ${packageScript}`)
  assert.equal(retiredByScript.has(packageScript), true, `retired entry is not auditable: ${packageScript}`)
  const retired = retiredByScript.get(packageScript)
  assert.equal(retired.retirementDisposition, "read_only_audit_not_dispatchable")
  assert.equal(fs.existsSync(path.join(ROOT, retired.entryFile)), true)
  assert.equal(sha256(fs.readFileSync(path.join(ROOT, retired.entryFile))), retired.sourceSha256)
}
assert.equal(entryRegistry.routingPrecedence.filesystemRecencySelectionForbidden, true)
assert.equal(entryRegistry.routingPrecedence.historicalEntrypointFallbackForbidden, true)
assert.equal(entryRegistry.historicalIsolation.autonomousResolverMayInvokeRetiredEntrypoint, false)
assert.equal(entryRegistry.transitionalHandoff.retiredFailureAdjudicator, JOINT_CONDITION_FULL_DATA_SCREEN_ADJUDICATION_COMMAND)
assert.equal(entryRegistry.transitionalHandoff.failureAdjudicatorRetirement, "completed_after_the_revision_57_task_was_consumed_into_the_revision_58_v2_cpu_acceptance_task")
assert.equal(entryRegistry.transitionalHandoff.v2CpuAcceptanceConsumption, "completed_at_revision_59_with_the_readonly_gpu_qualification_planning_task_registered")
assert.equal(entryRegistry.transitionalHandoff.currentSchedulerEntrypoint, "plan:ai-painter-stage4-v2-readonly-gpu-qualification")
assert.equal(retiredIndex.deferredRetirementHandoffs?.[0]?.status, "consumed_and_moved_to_retired_entrypoints")
assert.equal(retiredIndex.deferredRetirementHandoffs?.[0]?.consumedCurrentRegistryRevision, 57)
assert.equal(retiredIndex.deferredRetirementHandoffs?.[0]?.successorCpuAcceptanceRegistryRevision, 58)
assert.equal(retiredIndex.deferredRetirementHandoffs?.[0]?.readonlyGpuQualificationPlanningRegistryRevision, 59)

const cpuAcceptanceSource = read("scripts/run-ai-painter-stage4-v2-cpu-contract-acceptance.mjs")
const readonlyGpuPlanSource = read("scripts/plan-ai-painter-stage4-v2-readonly-gpu-qualification.mjs")
assert.match(cpuAcceptanceSource, /source_adjudication_successor_contract_sha256_mismatch/u)
assert.match(cpuAcceptanceSource, /manual_contract_sha256_not_authorized/u)
assert.match(cpuAcceptanceSource, /expectedPreviousRegistryRevision: authorization\.current\.registry\.registryRevision/u)
assert.match(cpuAcceptanceSource, /expectedPreviousRegistrySha256: authorization\.current\.registrySha256/u)
assert.match(cpuAcceptanceSource, /latestTrainingTerminal: authorization\.current\.registry\.latestTrainingTerminal/u)
assert.match(cpuAcceptanceSource, /taskId: NEXT_TASK/u)
assert.match(cpuAcceptanceSource, /nextMachineAction: NEXT_ACTION/u)
assert.match(readonlyGpuPlanSource, /gpuStarted: false/u)
assert.match(readonlyGpuPlanSource, /trainingStarted: false/u)
assert.match(adjudicatorSource, /NEXT_MACHINE_ACTION = "run:ai-painter-stage4-v2-cpu-contract-acceptance"/u)
assert.doesNotMatch(adjudicatorSource, /NEXT_MACHINE_ACTION = "verify:ai-painter-stage4-full-resolution-typed-semantic-transport-rgb-responsibility-cpu-contract"/u)
assert.match(cpuAcceptanceSource, /CURRENT_ACTION =\s*\n?\s*"run:ai-painter-stage4-v2-cpu-contract-acceptance"/u)

process.stdout.write(`${JSON.stringify({
  status: "passed",
  checks: {
    failureTerminalRoutesToAdjudicatingTask: true,
    formalCapabilityLifecycleStageUsed: true,
    automaticTrainingRetryForbidden: true,
    crossRunEvidenceRejected: true,
    missingFixedParentCreatedAndLeafReuseRejected: true,
    adjudicatorCreatesFixedParentBeforeExclusiveLeaf: true,
    consumedV1AdjudicatorRetiredAndV2SuccessorsRegistered: true,
    retiredEntrypointsAuditableAndNotSchedulable: true,
    taskControlMetadataProjectedFromRegistry: true,
    stage4V2CpuAcceptanceRequiresAdjudicatedShaBoundContract: true,
    stage4V2CpuAcceptanceAtomicallyTargetsCpuOnlyReadonlyGpuPlanning: true,
    v1AdjudicationDirectlyRoutesToV2CpuAcceptance: true,
  },
}, null, 2)}\n`)

function read(relative) {
  return fs.readFileSync(path.join(ROOT, ...relative.split("/")), "utf8")
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}
