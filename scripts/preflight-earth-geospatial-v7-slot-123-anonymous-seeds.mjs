import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import {
  MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
  MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
  MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
  buildMeasurementDrivenAnonymousLayoutProfile,
} from "./lib/measurement-driven-anonymous-topology.mjs"
import {
  COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
  buildMeasurementDerivedCoarseHydrologyProfile,
} from "./lib/measurement-derived-coarse-hydrology.mjs"

const ROOT = process.cwd()
const SLOT_ID = "v7-capacity-slot-123"
const AUTHORIZATION_ID =
  "project-owner-authorized-v7-capacity-slot-123-thai-dem-d8-coarse-main-channel-repair-20260728"
const MAXIMUM_CANDIDATE_COUNT = 64
const RUNTIME_ROOT = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-v7-mvp-slot-condition-runs",
)
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-slot-seed-preflight-runs"
const requestedSlotId = valueFor("--v7-slot-id")
const ownerAuthorizationId = valueFor("--owner-authorization-id")

assert(requestedSlotId === SLOT_ID, `preflight is restricted to ${SLOT_ID}`)
assert(
  ownerAuthorizationId === AUTHORIZATION_ID,
  "bounded seed preflight owner authorization is missing or invalid",
)

const createdAtUtc = new Date().toISOString()
const runId =
  `earth-geospatial-v7-slot-seed-preflight-${SLOT_ID}-` +
  createdAtUtc.replace(/[:.]/g, "-")
const baseline = selectLatestCompletedSlotRun()
const lineage = readJson(resolveProjectPath(baseline.lineagePath))
const seedInputs = [
  lineage.parentWorldFactsSha256,
  lineage.connectivityBlueprintSha256,
  lineage.v7SlotBinding?.measurementFingerprint,
  SLOT_ID,
]
assert(
  seedInputs.slice(0, 3).every((value) => /^[a-f0-9]{64}$/.test(value)),
  "seed preflight baseline lineage is incomplete",
)
const windowPlanPointer = readJson(
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json",
)
const windowPlan = readJson(windowPlanPointer.runPath)
const assignment = (windowPlan.assignments ?? []).find(
  (entry) => entry.slotId === SLOT_ID,
)
assert(assignment, "slot-123 measurement-window assignment is missing")
const coarseHydrologyProfile =
  buildMeasurementDerivedCoarseHydrologyProfile({
    assignment,
    root: ROOT,
  })
const measurementLayoutProfile =
  buildMeasurementDrivenAnonymousLayoutProfile({
    assignment,
    hasWater: true,
    coarseHydrologyProfile,
  })

appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action: "start_v7_slot_123_bounded_anonymous_seed_preflight",
  runId,
  kind: "bounded_seed_preflight",
  status: "running",
  title:
    "The bounded no-RGB anonymous seed preflight for V7 slot 123 started",
  titleZh: "V7 槽位123的有界无RGB匿名种子预检已启动",
  detail:
    `slotId=${SLOT_ID}; maximumCandidates=${MAXIMUM_CANDIDATE_COUNT}; topology=${measurementLayoutProfile.routeTopology}; macroTopologySource=measurement_facts`,
  detailZh:
    `槽位=${SLOT_ID}；最多候选=${MAXIMUM_CANDIDATE_COUNT}；拓扑=${measurementLayoutProfile.routeTopology}；宏观拓扑来源=测量事实`,
  script:
    "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs",
  currentStep: "bounded_anonymous_seed_preflight_started",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

const attempts = []
let selected = null
let unexpectedFailure = null
let candidateCounter = 0

while (
  attempts.length < MAXIMUM_CANDIDATE_COUNT &&
  candidateCounter < 1024 &&
  !selected &&
  !unexpectedFailure
) {
  candidateCounter += 1
  const seedRevision =
    `owner-directed-${SLOT_ID}-thai-dem-d8-coarse-main-channel-micro-` +
    `candidate-${candidateCounter}-20260728`
  const seedSha256 = calculateSeed(seedRevision)
  const processResult = spawnSync(
    process.execPath,
    [
      "scripts/build-earth-geospatial-complete-map-conditions.mjs",
      "--v7-slot-id",
      SLOT_ID,
      "--v7-slot-seed-revision",
      seedRevision,
      "--v7-slot-seed-preflight-authorization-id",
      AUTHORIZATION_ID,
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    },
  )
  const errorMessage = extractErrorMessage(
    processResult.stderr,
    processResult.error,
  )
  const failureCode =
    processResult.status === 0 ? null : classifyFailure(errorMessage)
  const evidence = findCandidateEvidence(seedRevision)
  const attempt = {
    attemptNumber: attempts.length + 1,
    candidateCounter,
    seedRevision,
    seedSha256,
    routeTopologyIndex:
      measurementLayoutProfile.routeTopologyIndex,
    routeTopology: measurementLayoutProfile.routeTopology,
    waterControlProfileIndex:
      measurementLayoutProfile.waterControlProfileIndex,
    measurementTopologyFingerprint:
      measurementLayoutProfile.topologySelection
        .measurementTopologyFingerprint,
    internalHydrologyFamily:
      measurementLayoutProfile.internalHydrologyProfile?.family,
    internalHydrologyProfileSha256:
      measurementLayoutProfile.internalHydrologyProfile
        ?.profileSha256,
    coarseHydrologyMainChannelFamily:
      COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
    coarseHydrologyMainChannelProfileSha256:
      coarseHydrologyProfile.profileSha256,
    macroTopologyInvariantAcrossRetrySeeds: true,
    processExitCode: processResult.status,
    status:
      processResult.status === 0
        ? "condition_package_ready"
        : "candidate_rejected",
    failureCode,
    errorMessage:
      processResult.status === 0 ? null : errorMessage.slice(0, 1200),
    evidencePath: evidence?.path ?? null,
    evidenceSha256: evidence?.sha256 ?? null,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
  }
  attempts.push(attempt)

  if (processResult.status === 0) {
    selected = attempt
  } else if (
    ![
      "route_naturalness_envelope_failed",
      "route_water_geometry_conflict",
      "water_naturalness_envelope_failed",
    ].includes(failureCode)
  ) {
    unexpectedFailure = attempt
  }
}

const finishedAtUtc = new Date().toISOString()
const status = selected
  ? "bounded_seed_preflight_selected_condition_package_ready"
  : unexpectedFailure
    ? "bounded_seed_preflight_failed_unexpected_error"
    : "bounded_seed_preflight_exhausted_without_passing_candidate"
const report = {
  schemaVersion:
    "earth-geospatial-v7-slot-bounded-anonymous-seed-preflight-v1",
  runId,
  status,
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  ownerAuthorizationId: AUTHORIZATION_ID,
  slotId: SLOT_ID,
  maximumCandidateCount: MAXIMUM_CANDIDATE_COUNT,
  evaluatedCandidateCount: attempts.length,
  baselineConditionRunId: baseline.runId,
  baselineConditionId: baseline.conditionId,
  baselineConditionManifestPath: baseline.path,
  baselineConditionManifestSha256: sha256File(
    resolveProjectPath(baseline.path),
  ),
  requiredRouteTopology:
    measurementLayoutProfile.routeTopology,
  measurementDrivenTopology: {
    methodId: MEASUREMENT_DRIVEN_GEOMETRY_METHOD_ID,
    routeTopologyFamily:
      MEASUREMENT_DRIVEN_ROUTE_TOPOLOGY_FAMILY,
    internalHydrologyFamily:
      MEASUREMENT_DRIVEN_INTERNAL_HYDROLOGY_FAMILY,
    coarseHydrologyMainChannelFamily:
      COARSE_HYDROLOGY_MAIN_CHANNEL_FAMILY,
    profileSha256: measurementLayoutProfile.profileSha256,
    coarseHydrologyMainChannelProfileSha256:
      coarseHydrologyProfile.profileSha256,
    measurementTopologyFingerprint:
      measurementLayoutProfile.topologySelection
        .measurementTopologyFingerprint,
    layoutVariant: measurementLayoutProfile.layoutVariant,
    waterControlProfileIndex:
      measurementLayoutProfile.waterControlProfileIndex,
    routeTopologyIndex:
      measurementLayoutProfile.routeTopologyIndex,
    internalHydrologyProfileSha256:
      measurementLayoutProfile.internalHydrologyProfile
        ?.profileSha256,
    internalHydrologySelectionByte:
      measurementLayoutProfile.topologySelection
        .internalHydrologySelectionByte,
    floodplainBasinSelectionByte:
      measurementLayoutProfile.topologySelection
        .floodplainBasinSelectionByte,
    connectivityPortsAreBoundaryConstraintsOnly:
      measurementLayoutProfile.internalHydrologyProfile
        ?.connectivityPortsAreBoundaryConstraintsOnly,
    singleBroadCenterlineIsOnlyInternalHydrology:
      measurementLayoutProfile.internalHydrologyProfile
        ?.singleBroadCenterlineIsOnlyInternalHydrology,
    retrySeedAffectsMacroTopology: false,
    retrySeedScope:
      measurementLayoutProfile.topologySelection.retrySeedScope,
  },
  formalRouteMethod:
    "aggregate_public_route_morphology_plus_multi_frequency_catmull_rom_v1",
  formalRoutePointContract:
    "11_anonymous_anchors_times_7_resample_steps_about_71_points",
  reviewThresholdsModified: false,
  routeGenerationAlgorithmModified: false,
  internalHydrologyAlgorithmModified: true,
  mainChannelAlgorithmModified: true,
  selectedCandidate: selected,
  unexpectedFailure,
  attempts,
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
  fileName: "preflight-report.json",
  record: report,
  latest: {
    slotId: SLOT_ID,
    selectedSeedRevision: selected?.seedRevision ?? null,
    selectedConditionRunPath: selected?.evidencePath ?? null,
    evaluatedCandidateCount: attempts.length,
  },
})
const reportSha256 = sha256File(resolveProjectPath(stored.runPath))

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action: selected
    ? "complete_v7_slot_123_bounded_anonymous_seed_preflight"
    : "block_v7_slot_123_bounded_anonymous_seed_preflight",
  runId,
  kind: "bounded_seed_preflight",
  status: selected ? "success" : unexpectedFailure ? "failed" : "blocked",
  title: selected
    ? "The bounded no-RGB seed preflight selected a passing slot-123 condition package"
    : "The bounded no-RGB slot-123 seed preflight stopped without a passing condition package",
  titleZh: selected
    ? "有界无RGB种子预检已为slot-123选出通过的条件包"
    : "有界无RGB种子预检未选出通过的slot-123条件包并已停止",
  detail: selected
    ? `evaluated=${attempts.length}; selected=${selected.seedRevision}; conditionEvidence=${selected.evidencePath}`
    : `evaluated=${attempts.length}; unexpectedFailure=${unexpectedFailure?.failureCode ?? "none"}`,
  detailZh: selected
    ? `已检查=${attempts.length}；选中=${selected.seedRevision}；条件证据=${selected.evidencePath}`
    : `已检查=${attempts.length}；意外失败=${unexpectedFailure?.failureCode ?? "无"}`,
  script:
    "scripts/preflight-earth-geospatial-v7-slot-123-anonymous-seeds.mjs",
  currentStep: selected
    ? "bounded_anonymous_seed_preflight_completed"
    : "bounded_anonymous_seed_preflight_blocked",
  evidencePath: stored.runPath,
  evidence: [
    stored.runPath,
    ...attempts
      .map((entry) => entry.evidencePath)
      .filter((value) => Boolean(value)),
  ],
  errorCode: selected
    ? null
    : unexpectedFailure?.failureCode ??
      "bounded_seed_preflight_exhausted",
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console[selected ? "log" : "error"](
  JSON.stringify(
    {
      ok: Boolean(selected),
      status,
      runId,
      evaluatedCandidateCount: attempts.length,
      selectedCandidate: selected,
      reportPath: stored.runPath,
      reportSha256,
      imagesGenerated: 0,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
)
process.exitCode = selected ? 0 : 1

function selectLatestCompletedSlotRun() {
  const candidates = fs
    .readdirSync(RUNTIME_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.includes(`slot-condition-${SLOT_ID}-`),
    )
    .map((entry) =>
      path.join(
        RUNTIME_ROOT,
        entry.name,
        "complete-map-condition-run.json",
      ),
    )
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => readJson(entry))
    .filter(
      (entry) =>
        entry.v7SlotId === SLOT_ID &&
        entry.status ===
          "complete_map_conditions_ready_rgb_authorization_required",
    )
    .sort(
      (left, right) =>
        Date.parse(right.createdAtUtc) -
        Date.parse(left.createdAtUtc),
    )
  assert(candidates.length > 0, `no completed baseline exists for ${SLOT_ID}`)
  return {
    ...candidates[0],
    path: projectPath(
      path.join(
        RUNTIME_ROOT,
        candidates[0].runId,
        "complete-map-condition-run.json",
      ),
    ),
  }
}

function calculateSeed(seedRevision) {
  return crypto
    .createHash("sha256")
    .update(
      Buffer.from(
        [
          ...seedInputs,
          seedRevision,
          "deidentified-complete-map-game-coordinate-normalization-v1",
        ].join(":"),
      ),
    )
    .digest("hex")
}

function findCandidateEvidence(seedRevision) {
  const candidates = fs
    .readdirSync(RUNTIME_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.includes(`slot-condition-${SLOT_ID}-`),
    )
    .flatMap((entry) => {
      const runRoot = path.join(RUNTIME_ROOT, entry.name)
      return [
        path.join(runRoot, "complete-map-condition-run.json"),
        path.join(runRoot, "failure.json"),
      ]
    })
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => ({
      path: entry,
      record: readJson(entry),
      modifiedAtMs: fs.statSync(entry).mtimeMs,
    }))
    .filter(
      (entry) =>
        entry.record.anonymousGameCoordinateSeedRevision ===
        seedRevision,
    )
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
  if (candidates.length === 0) return null
  return {
    path: projectPath(candidates[0].path),
    sha256: sha256File(candidates[0].path),
  }
}

function classifyFailure(message) {
  if (
    message.includes(
      "anonymous route generator could not satisfy the public-data naturalness envelope",
    )
  ) {
    return "route_naturalness_envelope_failed"
  }
  if (message.includes("anonymous water geometry conflicts with the route")) {
    return "route_water_geometry_conflict"
  }
  if (
    message.includes(
      "anonymous water generator could not satisfy the public-data naturalness envelope",
    )
  ) {
    return "water_naturalness_envelope_failed"
  }
  if (message.includes("V7 slot seed revision is not authorized")) {
    return "seed_revision_authorization_failed"
  }
  return "unexpected_condition_builder_failure"
}

function extractErrorMessage(stderr, processError) {
  if (processError) return processError.message
  const value = String(stderr ?? "")
  const marker = value.indexOf("Error:")
  if (marker >= 0) {
    return value.slice(marker + "Error:".length).trim()
  }
  return value.trim() || "condition builder exited without an error message"
}

function valueFor(flag) {
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

function sha256File(value) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(value))
    .digest("hex")
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
