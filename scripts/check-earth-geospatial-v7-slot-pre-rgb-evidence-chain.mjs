import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { catalogPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const SLOT_ID = "v7-capacity-slot-123"
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-pre-rgb-evidence-checks"
const preflightRunId = valueFor("--preflight-run-id")
const conditionRunId = valueFor("--condition-run-id")
const noveltyRunId = valueFor("--novelty-run-id")

assert(
  /^earth-geospatial-v7-slot-seed-preflight-v7-capacity-slot-123-/.test(
    preflightRunId ?? "",
  ),
  "slot-123 seed preflight run id is invalid",
)
assert(
  /^earth-geospatial-v7-slot-condition-v7-capacity-slot-123-/.test(
    conditionRunId ?? "",
  ),
  "slot-123 condition run id is invalid",
)
assert(
  /^ai-assisted-pre-rgb-condition-guide-novelty-v7-capacity-slot-123-/.test(
    noveltyRunId ?? "",
  ),
  "slot-123 pre-RGB novelty run id is invalid",
)

const createdAtUtc = new Date().toISOString()
const runId =
  `earth-geospatial-v7-slot-pre-rgb-evidence-check-${SLOT_ID}-` +
  createdAtUtc.replace(/[:.]/g, "-")
const database = new DatabaseSync(catalogPath)
const specifications = [
  {
    runId: preflightRunId,
    kind: "bounded_seed_preflight",
    requiredImmutableSuffix: "/preflight-report.json",
    minimumImmutableArtifactCount: 1,
    minimumEventCount: 2,
    minimumBilingualEventCount: 2,
  },
  {
    runId: conditionRunId,
    kind: "complete_map_condition_package",
    requiredImmutableSuffix: "/complete-map-condition-run.json",
    minimumImmutableArtifactCount: 36,
    minimumEventCount: 2,
    minimumBilingualEventCount: 2,
  },
  {
    runId: noveltyRunId,
    kind: "pre_rgb_condition_guide_novelty",
    requiredImmutableSuffix: "/audit-report.json",
    minimumImmutableArtifactCount: 1,
    minimumEventCount: 1,
    minimumBilingualEventCount: 1,
  },
]

const checks = specifications.map(checkRun)
database.close()
const failures = checks.flatMap((entry) => entry.failures)
const passed = failures.length === 0
const finishedAtUtc = new Date().toISOString()
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-pre-rgb-evidence-chain-check-v1",
  runId,
  status: passed
    ? "slot_123_pre_rgb_evidence_chain_verified"
    : "slot_123_pre_rgb_evidence_chain_verification_failed",
  passed,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  slotId: SLOT_ID,
  preflightRunId,
  conditionRunId,
  noveltyRunId,
  checks,
  failures,
  outputBoundary: {
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeStarted: false,
    worldPageChanged: false,
  },
  automaticStorage: true,
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "check-report.json",
  record: report,
  latest: {
    slotId: SLOT_ID,
    passed,
    preflightRunId,
    conditionRunId,
    noveltyRunId,
  },
})
const reportSha256 = sha256File(resolveProjectPath(stored.runPath))
const event = appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: passed
    ? "verify_v7_slot_123_pre_rgb_evidence_chain"
    : "fail_v7_slot_123_pre_rgb_evidence_chain_verification",
  runId,
  kind: "pre_rgb_evidence_chain_check",
  status: passed ? "success" : "failed",
  title: passed
    ? "The slot-123 pre-RGB SQLite, SHA-256, and bilingual event chain was verified"
    : "The slot-123 pre-RGB evidence-chain verification failed",
  titleZh: passed
    ? "slot-123生成前SQLite、SHA-256和双语事件证据链已核验"
    : "slot-123生成前证据链核验失败",
  detail: passed
    ? `preflight=${preflightRunId}; condition=${conditionRunId}; novelty=${noveltyRunId}; failures=0`
    : `failures=${failures.join(",")}`,
  detailZh: passed
    ? `种子预检=${preflightRunId}；条件=${conditionRunId}；查重=${noveltyRunId}；失败=0`
    : `失败=${failures.join("，")}`,
  script:
    "scripts/check-earth-geospatial-v7-slot-pre-rgb-evidence-chain.mjs",
  currentStep: "slot_123_pre_rgb_evidence_chain_checked",
  errorCode: passed ? null : "slot_123_pre_rgb_evidence_chain_invalid",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    ...checks.flatMap((entry) =>
      entry.immutableArtifacts.map((artifact) => artifact.logicalPath),
    ),
  ],
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console[passed ? "log" : "error"](
  JSON.stringify(
    {
      ok: passed,
      status: report.status,
      runId,
      reportPath: stored.runPath,
      reportSha256,
      ledgerEventId: event.id,
      checks: checks.map((entry) => ({
        runId: entry.runId,
        immutableArtifactCount: entry.immutableArtifactCount,
        hashVerifiedArtifactCount: entry.hashVerifiedArtifactCount,
        eventCount: entry.eventCount,
        bilingualEventCount: entry.bilingualEventCount,
        failures: entry.failures,
      })),
      imagesGenerated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
)
process.exitCode = passed ? 0 : 1

function checkRun(specification) {
  const artifacts = database
    .prepare(
      "SELECT logical_path, byte_size, sha256 FROM artifacts WHERE run_id = ? ORDER BY logical_path",
    )
    .all(specification.runId)
  const immutableArtifacts = artifacts
    .filter((entry) =>
      normalizePath(entry.logical_path).includes(
        `/${specification.runId}/`,
      ),
    )
    .map((entry) => {
      const resolved = resolveProjectPath(entry.logical_path)
      const exists = fs.existsSync(resolved)
      const actualByteSize = exists ? fs.statSync(resolved).size : null
      const actualSha256 = exists ? sha256File(resolved) : null
      return {
        logicalPath: normalizePath(entry.logical_path),
        indexedByteSize: entry.byte_size,
        actualByteSize,
        indexedSha256: entry.sha256,
        actualSha256,
        exists,
        byteSizeMatches:
          exists && actualByteSize === entry.byte_size,
        sha256Matches:
          exists &&
          /^[a-f0-9]{64}$/.test(entry.sha256 ?? "") &&
          actualSha256 === entry.sha256,
      }
    })
  const events = database
    .prepare(
      "SELECT event_id, status, title, title_zh, evidence_path FROM program_events WHERE run_id = ? ORDER BY timestamp_utc",
    )
    .all(specification.runId)
  const bilingualEventCount = events.filter(
    (entry) =>
      typeof entry.title === "string" &&
      entry.title.length > 0 &&
      typeof entry.title_zh === "string" &&
      entry.title_zh.length > 0,
  ).length
  const failures = []
  if (
    immutableArtifacts.length <
    specification.minimumImmutableArtifactCount
  ) {
    failures.push(
      `${specification.kind}:immutable_artifact_count_insufficient`,
    )
  }
  if (
    !immutableArtifacts.some((entry) =>
      entry.logicalPath.endsWith(
        specification.requiredImmutableSuffix,
      ),
    )
  ) {
    failures.push(
      `${specification.kind}:required_immutable_artifact_missing`,
    )
  }
  if (
    immutableArtifacts.some(
      (entry) =>
        !entry.exists ||
        !entry.byteSizeMatches ||
        !entry.sha256Matches,
    )
  ) {
    failures.push(
      `${specification.kind}:immutable_artifact_hash_or_size_mismatch`,
    )
  }
  if (events.length < specification.minimumEventCount) {
    failures.push(`${specification.kind}:event_count_insufficient`)
  }
  if (
    bilingualEventCount <
    specification.minimumBilingualEventCount
  ) {
    failures.push(
      `${specification.kind}:bilingual_event_count_insufficient`,
    )
  }
  return {
    runId: specification.runId,
    kind: specification.kind,
    immutableArtifactCount: immutableArtifacts.length,
    hashVerifiedArtifactCount: immutableArtifacts.filter(
      (entry) => entry.byteSizeMatches && entry.sha256Matches,
    ).length,
    eventCount: events.length,
    bilingualEventCount,
    immutableArtifacts,
    eventIds: events.map((entry) => entry.event_id),
    eventStatuses: events.map((entry) => entry.status),
    failures,
  }
}

function valueFor(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project root: ${value}`,
  )
  return resolved
}

function normalizePath(value) {
  return String(value).replace(/\\/g, "/")
}

function sha256File(value) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(value))
    .digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
