import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  auditPreRgbConditionGuideNovelty,
  persistPreRgbConditionGuideNoveltyAudit,
} from "./lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"

const ROOT = process.cwd()
const slotId = valueFor("--v7-slot-id")
const runtimeRoot = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-v7-mvp-slot-condition-runs",
)
const failureRoot =
  ".runtime/ai-painter/ai-assisted-pre-rgb-condition-guide-novelty-audits"
let failureRecorded = false
let conditionManifestPath = null
let conditionManifest = null
let expectedGuideManifestPath = null

try {
  await main()
} catch (error) {
  const recorded = recordFailure(error)
  console.error(JSON.stringify(recorded, null, 2))
  process.exitCode = 1
}

async function main() {
  assert(
    /^v7-capacity-slot-(10[8-9]|1[1-9][0-9]|20[0-9])$/.test(slotId ?? ""),
    "V7 slot must be inside the authorized slot-108 through slot-209 range",
  )

  conditionManifestPath = selectLatestSlotManifest(slotId)
  conditionManifest = readJson(conditionManifestPath)
  assert(
    conditionManifest.v7SlotId === slotId,
    "condition manifest slot identity mismatch",
  )
  assert(
    conditionManifest.status ===
      "complete_map_conditions_ready_rgb_authorization_required",
    "condition run is not ready for the pre-RGB gate",
  )
  assert(
    conditionManifest.outputBoundary?.imageGenerationStarted === false &&
      conditionManifest.outputBoundary?.rgbCreated === false &&
      conditionManifest.outputBoundary?.gpuTrainingStarted === false,
    "condition run crossed the RGB or GPU boundary before the novelty gate",
  )

  expectedGuideManifestPath = path.join(
    path.dirname(resolveProjectPath(conditionManifest.conditionPackPath)),
    "condition-guide-manifest.json",
  )
  const guideManifest = readJson(expectedGuideManifestPath)
  const audit = await auditPreRgbConditionGuideNovelty({
    sourceRecordId: slotId,
    guidePath: guideManifest.guidePath,
    blueprintPath: conditionManifest.blueprintPath,
  })
  const stored = persistPreRgbConditionGuideNoveltyAudit(audit)

  const result = {
    ok: audit.passed,
    status: audit.status,
    slotId,
    conditionRunId: conditionManifest.runId,
    conditionId: conditionManifest.conditionId,
    seedRevision: conditionManifest.anonymousGameCoordinateSeedRevision,
    conditionManifestPath: projectPath(conditionManifestPath),
    guidePath: guideManifest.guidePath,
    guideSha256: guideManifest.guideSha256,
    comparedReferenceCount:
      audit.historicalCompositionReferencesCompared,
    matchedRecordIds: audit.approvedMacroCompositionMatches.map(
      (entry) => entry.recordId,
    ),
    auditPath: stored.runPath,
    auditSha256: stored.sha256,
    imagesGenerated: 0,
    gpuTrainingStarted: false,
  }

  console[audit.passed ? "log" : "error"](
    JSON.stringify(result, null, 2),
  )
  process.exitCode = audit.passed ? 0 : 1
}

function recordFailure(error) {
  if (failureRecorded) throw error
  failureRecorded = true
  const createdAtUtc = new Date().toISOString()
  const safeSlotId = slotId ?? "unknown-slot"
  const runId =
    `ai-assisted-pre-rgb-condition-guide-novelty-failure-${safeSlotId}-` +
    createdAtUtc.replace(/[:.]/g, "-")
  const failureCode =
    error?.code === "ENOENT" &&
    String(error?.path ?? "").endsWith(
      "condition-guide-manifest.json",
    )
      ? "condition_guide_manifest_missing"
      : "pre_rgb_condition_guide_novelty_audit_error"
  const failure = {
    schemaVersion:
      "ai-assisted-pre-rgb-condition-guide-novelty-audit-failure-v1",
    runId,
    status: "failed_recorded",
    createdAtUtc,
    createdAtAsiaShanghai: formatShanghai(createdAtUtc),
    slotId,
    conditionRunId: conditionManifest?.runId ?? null,
    conditionId: conditionManifest?.conditionId ?? null,
    conditionManifestPath: conditionManifestPath
      ? projectPath(conditionManifestPath)
      : null,
    conditionManifestSha256:
      conditionManifestPath && fs.existsSync(conditionManifestPath)
        ? sha256File(conditionManifestPath)
        : null,
    expectedGuideManifestPath: expectedGuideManifestPath
      ? projectPath(expectedGuideManifestPath)
      : null,
    failedCommand:
      `npm run audit:current-earth-geospatial-v7-slot-pre-rgb-condition-guide-novelty -- --v7-slot-id ${safeSlotId}`,
    processExitCode: 1,
    failureCode,
    errorName: error?.name ?? "Error",
    errorCode: error?.code ?? null,
    errorMessage: error?.message ?? String(error),
    errorPath: error?.path ? projectPath(error.path) : null,
    diagnosisBoundary: {
      conditionEvidenceModified: false,
      businessLogicModified: false,
      reviewThresholdModified: false,
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
    },
    nextAction:
      "build_the_current_slot_semantic_condition_guide_then_rerun_the_same_pre_rgb_novelty_audit",
    automaticStorage: true,
  }
  const written = writeImmutableProgramRun({
    root: failureRoot,
    runId,
    fileName: "failure.json",
    record: failure,
    latest: {
      slotId,
      conditionRunId: conditionManifest?.runId ?? null,
      conditionId: conditionManifest?.conditionId ?? null,
      failureCode,
    },
  })
  const event = appendAiPainterProgramEvent({
    action: "record_pre_rgb_condition_guide_novelty_audit_failure",
    runId,
    kind: "step_failed",
    status: "failed",
    title:
      "The pre-RGB condition-guide novelty audit failed before comparison and saved evidence",
    titleZh:
      "预 RGB 条件引导图新颖性审核在比较前失败，程序已保存证据",
    detail:
      `slotId=${safeSlotId}; failureCode=${failureCode}; error=${failure.errorMessage}`,
    detailZh:
      `槽位=${safeSlotId}；失败码=${failureCode}；错误=${failure.errorMessage}`,
    script:
      "scripts/audit-current-earth-geospatial-v7-slot-pre-rgb-condition-guide-novelty.mjs",
    currentStep: "pre_rgb_condition_guide_novelty_audit_failed",
    error: failure.errorMessage,
    errorZh: failure.errorMessage,
    evidencePath: written.runPath,
    evidence: [
      written.runPath,
      ...(failure.conditionManifestPath
        ? [failure.conditionManifestPath]
        : []),
    ],
    nextAction: failure.nextAction,
    nextActionZh:
      "为当前槽位构建语义条件引导图，然后重新执行同一预 RGB 新颖性审核",
    finalGameMapSuccess: false,
    canEnterWorld: false,
  })
  return {
    ok: false,
    status: failure.status,
    runId,
    slotId,
    conditionRunId: failure.conditionRunId,
    conditionId: failure.conditionId,
    failureCode,
    error: failure.errorMessage,
    failurePath: written.runPath,
    failureSha256: sha256File(resolveProjectPath(written.runPath)),
    ledgerEventId: event.id,
    imagesGenerated: 0,
    gpuTrainingStarted: false,
  }
}

function selectLatestSlotManifest(targetSlotId) {
  const candidates = fs.readdirSync(runtimeRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.includes(`slot-condition-${targetSlotId}-`),
    )
    .map((entry) => path.join(runtimeRoot, entry.name, "complete-map-condition-run.json"))
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => ({ path: entry, manifest: readJson(entry) }))
    .filter((entry) => entry.manifest.v7SlotId === targetSlotId)
    .sort(
      (left, right) =>
        Date.parse(right.manifest.createdAtUtc) -
        Date.parse(left.manifest.createdAtUtc),
    )
  assert(candidates.length > 0, `no condition run exists for ${targetSlotId}`)
  return candidates[0].path
}

function valueFor(flag) {
  const inline = process.argv.find((entry) => entry.startsWith(`${flag}=`))
  if (inline) return inline.slice(flag.length + 1)
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"))
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value)
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project root: ${value}`,
  )
  return resolved
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/")
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
