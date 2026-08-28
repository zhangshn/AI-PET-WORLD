import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  CURRENT_EXECUTION_REGISTRY_PATH,
  initializeCurrentExecutionRegistry,
  readCurrentExecutionRegistry,
} from "../src/server/ai-painter-current-execution-registry.mjs"

const projectRoot = process.cwd()
const serverSource = await readFile(
  path.join(projectRoot, "src/server/ai-painter-current-training.ts"),
  "utf8",
)
const modelSourcesBody = between(
  serverSource,
  "const modelSources = [",
  "] as const;",
)
const buildSnapshotBody = between(
  serverSource,
  "async function buildSnapshot()",
  "async function readCurrentR5Stage4TaskCapsule()",
)

assert.match(serverSource, /readCurrentExecutionRegistry/)
assert.match(buildSnapshotBody, /readCurrentExecutionRegistry\(root\)/)
assert.doesNotMatch(buildSnapshotBody, /readCurrentR5Stage4TaskCapsule\(/)
assert.doesNotMatch(buildSnapshotBody, /readLatestPostDecodeFormalExecution\(/)
assert.doesNotMatch(
  modelSourcesBody,
  /stage4-post-decode-object-rgb-controlled-smokes/,
)
assert.doesNotMatch(
  serverSource,
  /stage4-post-decode-object-rgb-controlled-smokes/,
)
assert.doesNotMatch(
  serverSource,
  /readCurrentPostDecodeObjectRgbSmokeTaskCapsule/,
)
assert.match(serverSource, /code: "candidate_planned"/)
assert.match(serverSource, /code: "current_registry_unknown_or_stale"/)
assert.match(serverSource, /fallback_to_historical_smoke/)

const fixtureRoot = await mkdtemp(
  path.join(os.tmpdir(), "ai-painter-current-registry-"),
)
try {
  const planningRoot =
    ".runtime/ai-painter/stage4-post-decode-failure-bounded-candidate-plans/current-plan"
  const formalRoot =
    ".runtime/ai-painter/stage4-post-decode-object-rgb-formal-stage0/current-formal"
  const taskTerminalPath = `${planningRoot}/phase-terminal.json`
  const candidatePath = `${planningRoot}/bounded-candidate.json`
  const taskCapsulePath = `${planningRoot}/local-task-capsule.json`
  const latestTrainingTerminalPath = `${formalRoot}/phase-terminal.json`
  const recordedAtUtc = "2026-08-25T16:09:12.907Z"

  const candidate = {
    schemaVersion: "stage4-post-decode-bounded-candidate-v1",
    status: "cpu_inactive_candidate_planned_not_implemented",
    selectedCandidate: {
      candidateKind:
        "post_decode_full_condition_route_and_object_responsibility_renderer",
    },
    recordedAtUtc,
  }
  await writeJson(fixtureRoot, candidatePath, candidate)
  const candidateSha256 = await sha256File(fixtureRoot, candidatePath)

  const taskTerminal = {
    schemaVersion: "stage4-post-decode-failure-bounded-planning-terminal-v1",
    executionState: "completed",
    status: "bounded_candidate_planning_completed",
    planningRunId: "current-plan",
    nextAction:
      "implement_cpu_inactive_post_decode_full_condition_route_object_responsibility_renderer",
    candidate: { path: candidatePath, sha256: candidateSha256 },
    fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
    recordedAtUtc,
  }
  await writeJson(fixtureRoot, taskTerminalPath, taskTerminal)
  const taskTerminalSha256 = await sha256File(fixtureRoot, taskTerminalPath)

  const taskCapsule = {
    schemaVersion: "ai-painter-local-task-capsule-v2",
    latestTerminal: {
      path: taskTerminalPath,
      sha256: taskTerminalSha256,
    },
    recordedAtUtc,
  }
  await writeJson(fixtureRoot, taskCapsulePath, taskCapsule)

  await writeJson(fixtureRoot, latestTrainingTerminalPath, {
    schemaVersion: "stage4-post-decode-object-rgb-stage0-terminal-v1",
    executionState: "completed",
    status: "post_decode_object_rgb_stage0_real_visual_failure",
    runId: "current-formal",
    recordedAtUtc,
  })
  await writeJson(fixtureRoot, `${formalRoot}/execution-state.json`, {
    status: "completed",
    phase: "machine_review_completed",
    updatedAtUtc: recordedAtUtc,
  })
  await writeJson(fixtureRoot, `${formalRoot}/machine-review.json`, {
    previewCount: 6,
    previewPassCount: 2,
    previewFailCount: 4,
    recordedAtUtc,
  })
  await writeJson(fixtureRoot, `${formalRoot}/training-output/progress.json`, {
    phase: "training_completed",
    epoch: 40,
    epochTarget: 40,
    updatedAtUtc: recordedAtUtc,
  })

  const archivedNamespace =
    ".runtime/ai-painter/stage4-post-decode-object-rgb-controlled-smokes"
  const migrated = await initializeCurrentExecutionRegistry({
    projectRoot: fixtureRoot,
    currentTaskCapsulePath: taskCapsulePath,
    currentTaskTerminalPath: taskTerminalPath,
    currentCandidatePath: candidatePath,
    latestTrainingTerminalPath,
    archivedEvidenceNamespaces: [archivedNamespace],
  })
  assert.equal(migrated.ok, true)
  assert.equal(migrated.status, "verified")
  assert.deepEqual(migrated.archivedNamespaces, [archivedNamespace])
  assert.equal(migrated.taskCapsule.candidateTerminal.status, "planned")
  assert.equal(migrated.latestTrainingExecution.runId, "current-formal")

  const reread = await readCurrentExecutionRegistry(fixtureRoot)
  assert.equal(reread.ok, true)
  assert.equal(reread.registry.registryRevision, 1)

  candidate.selectedCandidate.candidateKind = "tampered-candidate"
  await writeJson(fixtureRoot, candidatePath, candidate)
  const tampered = await readCurrentExecutionRegistry(fixtureRoot)
  assert.equal(tampered.ok, false)
  assert.equal(tampered.status, "unknown_or_stale")
  assert.match(tampered.errorCode, /hash_mismatch/)

  await assert.rejects(
    initializeCurrentExecutionRegistry({
      projectRoot: fixtureRoot,
      currentTaskCapsulePath: taskCapsulePath,
      currentTaskTerminalPath: taskTerminalPath,
      currentCandidatePath: candidatePath,
      latestTrainingTerminalPath,
      archivedEvidenceNamespaces: [archivedNamespace],
    }),
    /current_execution_registry_already_exists/,
  )

  const currentBytes = await readFile(
    path.join(fixtureRoot, ...CURRENT_EXECUTION_REGISTRY_PATH.split("/")),
  )
  assert.equal(currentBytes.length > 0, true)
} finally {
  await rm(fixtureRoot, { recursive: true, force: true })
}

process.stdout.write(
  `${JSON.stringify({
    status: "passed",
    checks: {
      currentProjectionUsesOnlyRegistry: true,
      archivedSmokeExcludedFromDefaultSources: true,
      immutableEvidenceHashRecomputed: true,
      tamperFailsClosedWithoutHistoricalFallback: true,
      duplicateInitializationRejected: true,
    },
  }, null, 2)}\n`,
)

function between(value, start, end) {
  const startIndex = value.indexOf(start)
  assert.notEqual(startIndex, -1, `missing_start_${start}`)
  const endIndex = value.indexOf(end, startIndex + start.length)
  assert.notEqual(endIndex, -1, `missing_end_${end}`)
  return value.slice(startIndex, endIndex)
}

async function writeJson(root, relativePath, value) {
  const absolutePath = path.join(root, ...relativePath.split("/"))
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

async function sha256File(root, relativePath) {
  const bytes = await readFile(path.join(root, ...relativePath.split("/")))
  return createHash("sha256").update(bytes).digest("hex")
}
