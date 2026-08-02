import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  projectPath,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"
import {
  buildAllHistoryGenerationInputBoundary,
  validateGenerationInputHistoryBoundary,
} from "./lib/generation-input-history-boundary.mjs"
import {
  auditAiAssistedCompositionNovelty,
} from "./lib/ai-assisted-composition-novelty.mjs"
import {
  auditPreRgbConditionGuideNovelty,
} from "./lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs"

const ROOT = process.cwd()
const REQUEST_BUILDER =
  "scripts/build-ai-assisted-conditional-rgb-generation-request.mjs"
const REQUEST_CHECKER =
  "scripts/check-ai-assisted-conditional-rgb-request.mjs"
const BOUNDARY_LIBRARY =
  "scripts/lib/generation-input-history-boundary.mjs"
const PRE_RGB_NOVELTY_AUDITOR =
  "scripts/lib/ai-assisted-pre-rgb-condition-guide-novelty.mjs"
const POST_RGB_NOVELTY_AUDITOR =
  "scripts/lib/ai-assisted-composition-novelty.mjs"
const REQUEST_POINTER =
  ".runtime/ai-painter/ai-assisted-cold-start/conditional-rgb-generation-requests/latest.json"
const STANDARD_POINTER =
  ".runtime/ai-painter/foundational-complete-map-visual-standards/latest.json"
const OUTPUT_ROOT =
  ".runtime/ai-painter/ai-assisted-all-history-generation-input-boundary-checks"
const LIBRARY_INDEX =
  "data/world-samples/original-image-library/natural-home-v1/index.json"

const createdAtUtc = new Date().toISOString()
const runId =
  "ai-assisted-all-history-generation-input-boundary-check-" +
  createdAtUtc.replace(/[:.]/g, "-")
const requestPointer = readJson(REQUEST_POINTER)
const historicalRequest = readJson(requestPointer.requestPath)
const historicalEvidence = readJson(
  historicalRequest.promptEvidencePath,
)
const guideManifest = readJson(
  historicalRequest.conditionGuideManifestPath,
)
const conditionPack = readJson(
  historicalRequest.conditionPackPath,
)
const standardPointer = readJson(STANDARD_POINTER)
const standardPath =
  standardPointer.standardPath ?? standardPointer.runPath
const visualStandard = readJson(standardPath)
const boundary = buildAllHistoryGenerationInputBoundary()
const noveltyGate = {
  status:
    historicalRequest.preRgbConditionGuideNoveltyAudit
      ?.status ?? "pre_rgb_condition_guide_novelty_passed",
  passed: true,
  historicalCompleteMapConditionGuidesCompared:
    historicalRequest.preRgbConditionGuideNoveltyAudit
      ?.historicalCompleteMapConditionGuidesCompared ?? 0,
  matchedHistoricalCompositionCount: 0,
  historicalRecordIdsIncluded: false,
  historicalGuidePathsIncluded: false,
  historicalComparisonMetricsIncluded: false,
  auditEvidenceForwardedToGenerator: false,
}
const {
  preRgbConditionGuideNoveltyAudit:
    _historicalRequestAudit,
  ...requestWithoutHistoricalAudit
} = historicalRequest
const {
  preRgbConditionGuideNoveltyAudit:
    _historicalEvidenceAudit,
  ...evidenceWithoutHistoricalAudit
} = historicalEvidence
const currentRequestFixture = {
  ...requestWithoutHistoricalAudit,
  allHistoryGenerationInputBoundary: boundary,
  preRgbConditionGuideNoveltyGate: noveltyGate,
}
const currentEvidenceFixture = {
  ...evidenceWithoutHistoricalAudit,
  allHistoryGenerationInputBoundary: boundary,
  preRgbConditionGuideNoveltyGate: noveltyGate,
}
const passingResult =
  validateGenerationInputHistoryBoundary({
    root: ROOT,
    request: currentRequestFixture,
    evidence: currentEvidenceFixture,
    guideManifest,
    conditionPack,
    visualStandard,
  })

const historicalImagePathFixture =
  validateGenerationInputHistoryBoundary({
    root: ROOT,
    request: {
      ...currentRequestFixture,
      referenceImagePaths: [
        "data/world-samples/original-image-library/natural-home-v1/complete-maps/ai-cold-start-map-001-tropical-lowland/source/original.png",
      ],
    },
    evidence: currentEvidenceFixture,
    guideManifest,
    conditionPack,
    visualStandard,
  })
const multipleReferenceFixture =
  validateGenerationInputHistoryBoundary({
    root: ROOT,
    request: {
      ...currentRequestFixture,
      referenceImagePaths: [
        ...currentRequestFixture.referenceImagePaths,
        "data/world-samples/original-image-library/natural-home-v1/complete-maps/ai-cold-start-map-002-inland-river-valley/source/original.png",
      ],
    },
    evidence: currentEvidenceFixture,
    guideManifest,
    conditionPack,
    visualStandard,
  })
const slotSpecificBoundaryFixture =
  validateGenerationInputHistoryBoundary({
    root: ROOT,
    request: {
      ...currentRequestFixture,
      allHistoryGenerationInputBoundary: {
        ...boundary,
        scope: "slot_038_and_039_only",
      },
    },
    evidence: currentEvidenceFixture,
    guideManifest,
    conditionPack,
    visualStandard,
  })
const mismatchedGuideFixture =
  validateGenerationInputHistoryBoundary({
    root: ROOT,
    request: currentRequestFixture,
    evidence: currentEvidenceFixture,
    guideManifest: {
      ...guideManifest,
      conditionPackId: "historical-condition-pack",
    },
    conditionPack,
    visualStandard,
  })
const historicalAuditDetailFixture =
  validateGenerationInputHistoryBoundary({
    root: ROOT,
    request: {
      ...currentRequestFixture,
      preRgbConditionGuideNoveltyAudit: {
        status: "fixture_historical_audit_details",
        historicalRecordIds: [
          "fixture-historical-record-must-not-reach-generator",
        ],
        historicalGuidePaths: [
          "fixture/historical-condition-guide.png",
        ],
      },
    },
    evidence: currentEvidenceFixture,
    guideManifest,
    conditionPack,
    visualStandard,
  })

const builderSource = readText(REQUEST_BUILDER)
const checkerSource = readText(REQUEST_CHECKER)
const preRgbNoveltySource = readText(PRE_RGB_NOVELTY_AUDITOR)
const postRgbNoveltySource = readText(POST_RGB_NOVELTY_AUDITOR)
const libraryIndex = readJson(LIBRARY_INDEX)
const latestCompleteMapRecord = [...(libraryIndex.records ?? [])]
  .filter((record) => record.categoryId === "complete-maps")
  .sort(
    (left, right) =>
      Date.parse(left.createdAtUtc ?? 0) -
      Date.parse(right.createdAtUtc ?? 0),
  )
  .at(-1)
if (
  !latestCompleteMapRecord?.relativeDirectory ||
  !latestCompleteMapRecord?.originalImage?.path ||
  !latestCompleteMapRecord?.conditionBinding?.guidePath
) {
  throw new Error(
    "latest complete-map record is missing image or condition-guide binding",
  )
}
const latestCompleteMapImagePath = path.join(
  latestCompleteMapRecord.relativeDirectory,
  latestCompleteMapRecord.originalImage.path,
)
const actualPostRgbAllHistoryAudit =
  await auditAiAssistedCompositionNovelty({
    record: latestCompleteMapRecord,
    imagePath: latestCompleteMapImagePath,
  })
const actualPreRgbAllHistoryAudit =
  await auditPreRgbConditionGuideNovelty({
    sourceRecordId:
      latestCompleteMapRecord.conditionBinding.sourceRecordId ??
      latestCompleteMapRecord.recordId,
    guidePath:
      latestCompleteMapRecord.conditionBinding.guidePath,
    candidateRecordId: latestCompleteMapRecord.recordId,
  })
const checks = {
  currentConditionGuideOnlyFixturePasses:
    passingResult.passed === true &&
    passingResult.generationInputImageCount === 1,
  anyHistoricalImagePathIsRejected:
    historicalImagePathFixture.passed === false &&
    historicalImagePathFixture.issues.includes(
      "historical_project_image_path_supplied_to_generator",
    ),
  multipleImageReferencesAreRejected:
    multipleReferenceFixture.passed === false &&
    multipleReferenceFixture.issues.includes(
      "generation_must_have_exactly_one_current_condition_guide",
    ),
  slotSpecificExceptionIsRejected:
    slotSpecificBoundaryFixture.passed === false &&
    slotSpecificBoundaryFixture.issues.includes(
      "request_all_history_generation_input_boundary_invalid",
    ),
  mismatchedHistoricalGuideIsRejected:
    mismatchedGuideFixture.passed === false &&
    mismatchedGuideFixture.issues.includes(
      "condition_guide_not_bound_to_current_condition_pack",
    ),
  historicalAuditDetailsAreNotGeneratorInput:
    historicalAuditDetailFixture.passed === false &&
    historicalAuditDetailFixture.issues.includes(
      "historical_novelty_audit_details_forwarded_to_generator",
    ),
  legacyHistoricalRecordModeDisabled:
    builderSource.includes(
      "legacy source-record RGB generation is disabled because a historical record must never be a new generation input",
    ),
  stoppedContinuousBatchModeDisabled:
    builderSource.includes(
      "the stopped V7 continuous RGB batch is disabled",
    ),
  builderEnforcesBoundaryBeforeWritingRequest:
    builderSource.indexOf(
      "assertGenerationInputHistoryBoundary({",
    ) <
      builderSource.indexOf(
        "const requestPath = path.join(requestDir",
      ),
  independentCheckerEnforcesSameBoundary:
    checkerSource.includes(
      "validateGenerationInputHistoryBoundary({",
    ) &&
    checkerSource.includes(
      "for (const issue of generationInputHistoryBoundary.issues)",
    ),
  preRgbAllHistoryComparisonFailsClosed:
    preRgbNoveltySource.includes(
      "historical_condition_guide_comparison_incomplete",
    ) &&
    preRgbNoveltySource.includes(
      "skippedRecordCount === 0",
    ) &&
    preRgbNoveltySource.includes(
      "all_chronology_eligible_historical_complete_map_condition_guides",
    ),
  postRgbAllHistoryComparisonFailsClosed:
    postRgbNoveltySource.includes(
      "historical_complete_map_comparison_incomplete",
    ) &&
    postRgbNoveltySource.includes(
      "if (skippedRecordCount > 0)",
    ) &&
    postRgbNoveltySource.includes(
      "all_chronology_eligible_historical_complete_map_images",
    ),
  actualPreRgbAllHistoryCoverageComplete:
    actualPreRgbAllHistoryAudit.skippedRecordCount === 0 &&
    actualPreRgbAllHistoryAudit
      .historicalCompleteMapConditionGuidesCompared ===
      actualPreRgbAllHistoryAudit
        .chronologyEligibleConditionGuideCount,
  actualPostRgbAllHistoryCoverageComplete:
    actualPostRgbAllHistoryAudit.skippedRecordCount === 0 &&
    actualPostRgbAllHistoryAudit
      .historicalCompleteMapImagesCompared ===
      actualPostRgbAllHistoryAudit.chronologyEligibleRecordCount,
  policyScopeIsAllPriorImages:
    boundary.scope ===
      "all_prior_project_images_without_exception" &&
    boundary.allPriorRgbExcludedFromGenerator === true &&
    boundary.allPriorConditionGuidesExcludedFromGenerator ===
      true &&
    boundary.allPriorInternalGeometryExcludedFromGenerator ===
      true &&
    boundary.allPriorCompositionSkeletonsExcludedFromGenerator ===
      true,
  imageGenerationNotStarted: true,
  gpuTrainingNotStarted: true,
}
const failedChecks = Object.entries(checks)
  .filter(([, passed]) => passed !== true)
  .map(([name]) => name)
if (failedChecks.length > 0) {
  throw new Error(
    `all-history generation input boundary checks failed: ${failedChecks.join(", ")}; positiveIssues=${passingResult.issues.join(",")}`,
  )
}

const finishedAtUtc = new Date().toISOString()
const report = {
  schemaVersion:
    "ai-assisted-all-history-generation-input-boundary-check-v1",
  runId,
  status:
    "all_prior_project_images_blocked_from_every_generation_input",
  createdAtUtc,
  createdAtAsiaShanghai: formatShanghai(createdAtUtc),
  finishedAtUtc,
  finishedAtAsiaShanghai: formatShanghai(finishedAtUtc),
  policy: boundary,
  positiveFixture: passingResult,
  negativeFixtures: {
    historicalImagePath: historicalImagePathFixture,
    multipleReferences: multipleReferenceFixture,
    slotSpecificException: slotSpecificBoundaryFixture,
    mismatchedGuide: mismatchedGuideFixture,
    historicalAuditDetails: historicalAuditDetailFixture,
  },
  actualAllHistoryCoverage: {
    candidateRecordId: latestCompleteMapRecord.recordId,
    preRgb: {
      comparisonScope:
        actualPreRgbAllHistoryAudit.comparisonScope,
      chronologyEligibleConditionGuideCount:
        actualPreRgbAllHistoryAudit
          .chronologyEligibleConditionGuideCount,
      compared:
        actualPreRgbAllHistoryAudit
          .historicalCompleteMapConditionGuidesCompared,
      skippedRecordCount:
        actualPreRgbAllHistoryAudit.skippedRecordCount,
      issueCodes:
        actualPreRgbAllHistoryAudit.issues.map(
          (entry) => entry.code,
        ),
    },
    postRgb: {
      comparisonScope:
        actualPostRgbAllHistoryAudit.comparisonScope,
      chronologyEligibleRecordCount:
        actualPostRgbAllHistoryAudit.chronologyEligibleRecordCount,
      compared:
        actualPostRgbAllHistoryAudit
          .historicalCompleteMapImagesCompared,
      skippedRecordCount:
        actualPostRgbAllHistoryAudit.skippedRecordCount,
      issueCodes:
        actualPostRgbAllHistoryAudit.issues.map(
          (entry) => entry.code,
        ),
    },
  },
  checks,
  failedChecks,
  programFiles: [
    artifactDescriptor(REQUEST_BUILDER),
    artifactDescriptor(REQUEST_CHECKER),
    artifactDescriptor(BOUNDARY_LIBRARY),
    artifactDescriptor(PRE_RGB_NOVELTY_AUDITOR),
    artifactDescriptor(POST_RGB_NOVELTY_AUDITOR),
  ],
  outputBoundary: {
    requestCreated: false,
    conditionCreated: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
    runtimeFrameCreated: false,
    worldEntryStarted: false,
  },
}
const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "boundary-check-report.json",
  record: report,
  latest: {
    status: report.status,
    failedCheckCount: 0,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
})
indexFile(stored.runPath)
const reportSha256 = sha256File(stored.runPath)

appendAiPainterProgramEvent({
  timestamp: finishedAtUtc,
  action:
    "all_history_generation_input_boundary_check_completed",
  runId,
  kind: "repair_check",
  status: "success",
  title:
    "All prior project images are blocked from generation inputs",
  titleZh: "全部前置项目图片已禁止进入生成输入",
  detail:
    `checks=${Object.keys(checks).length}; failed=0; reportSha256=${reportSha256}; RGB=false; GPU=false`,
  detailZh:
    `检查项=${Object.keys(checks).length}；失败=0；报告SHA-256=${reportSha256}；RGB=false；GPU=false`,
  script: projectPath(import.meta.filename),
  currentStep:
    "all_prior_project_images_blocked_from_generation",
  evidencePath: stored.runPath,
  finalGameMapSuccess: false,
  canEnterWorld: false,
})

console.log(
  JSON.stringify(
    {
      ok: true,
      runId,
      status: report.status,
      reportPath: stored.runPath,
      reportSha256,
      checkCount: Object.keys(checks).length,
      imageGenerationStarted: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
)

function artifactDescriptor(relativePath) {
  return {
    path: relativePath,
    sha256: sha256File(relativePath),
  }
}

function indexFile(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath)
  const stats = fs.statSync(absolutePath)
  indexArtifact({
    logicalPath: logicalProjectPath(absolutePath),
    physicalUri: fs.realpathSync(absolutePath),
    storageLayer: "hot",
    runId,
    byteSize: stats.size,
    modifiedAtUtc: stats.mtime.toISOString(),
    sha256: sha256File(absolutePath),
  })
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath))
}

function readText(relativePath) {
  return fs.readFileSync(path.resolve(ROOT, relativePath), "utf8")
}

function sha256File(relativePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.resolve(ROOT, relativePath)))
    .digest("hex")
}
