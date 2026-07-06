import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText

  module._compile(output, filename)
}

const {
  getAllDestinyCommonReviewQueueProfiles,
  getAllDestinyContentIntakeDirectoryRules,
  getAllDestinyContentIntakeDomainProfiles
} = require("../../src/ai/destiny-core/content-intake/content-intake-contract.ts")

const {
  getAllZiweiDataAnalysisUsageProfiles,
  getAllZiweiDataCleanedIntakeResultRecords,
  getAllZiweiDataCleaningPipelineProfiles,
  getAllZiweiDataCleaningPipelineScenarios,
  getAllZiweiDataCollectionAdapterProfiles,
  getAllZiweiDataCollectionAdmissionDecisionCandidates,
  getAllZiweiDataCollectionAuditRecords,
  getAllZiweiDataCollectionBatchPlans,
  getAllZiweiDataCollectionCleaningInputDrafts,
  getAllZiweiDataCollectionCleanedResultCandidates,
  getAllZiweiDataCollectionExecutionTaskRecords,
  getAllZiweiDataCollectionFragmentCaptureInputs,
  getAllZiweiDataCollectionFragmentResultCandidates,
  getAllZiweiDataCollectionFieldProfiles,
  getAllZiweiDataCollectionJobBlockRecords,
  getAllZiweiDataCollectionJobDrafts,
  getAllZiweiDataCollectionPromotionDecisionRecords,
  getAllZiweiDataCollectionPromotionGateProfiles,
  getAllZiweiDataCollectionReviewQueueItemDrafts,
  getAllZiweiDataCollectionReviewRouteCandidates,
  getAllZiweiDataCollectionRunBatches,
  getAllZiweiDataCollectionRunResultDrafts,
  getAllZiweiDataCollectionSourceResultCandidates,
  getAllZiweiDataCollectionSourceRegistrationDrafts,
  getAllZiweiDataCollectionTopicMappingCandidates,
  getAllZiweiDataConflictSignalProfiles,
  getAllZiweiDataDedupProfiles,
  getAllZiweiDataDictionaryAdmissionDecisionRecords,
  getAllZiweiDataDictionaryAdmissionPolicyProfiles,
  getAllZiweiDataDictionaryTopicMappingProfiles,
  getAllZiweiDataEntityExtractionProfiles,
  getAllZiweiDataIntakeClosureReports,
  getAllZiweiDataIntakeStagePlans,
  getAllZiweiDataReviewQueueProfiles,
  getAllZiweiDataSourceStorageBoundaryProfiles,
  getAllZiweiDataTopicMappings,
  getAllZiweiDataUsabilityScoreRules,
  getAllZiweiDataSourceSeedRecords,
  getZiweiDataCollectionExecutorProfile,
  getAllZiweiExternalDataSourceRecords,
  getAllZiweiRawIntakeFragmentSlots
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

function fail(message) {
  console.error(`[check-p35-data-intake] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

const plans = getAllZiweiDataIntakeStagePlans()
const closureReports = getAllZiweiDataIntakeClosureReports()
const analysisUsageProfiles = getAllZiweiDataAnalysisUsageProfiles()
const collectionFieldProfiles = getAllZiweiDataCollectionFieldProfiles()
const sourceSeedRecords = getAllZiweiDataSourceSeedRecords()
const collectionBatchPlans = getAllZiweiDataCollectionBatchPlans()
const collectionAdapterProfiles = getAllZiweiDataCollectionAdapterProfiles()
const collectionExecutorProfile = getZiweiDataCollectionExecutorProfile()
const collectionExecutionTaskRecords = getAllZiweiDataCollectionExecutionTaskRecords()
const collectionSourceRegistrationDrafts = getAllZiweiDataCollectionSourceRegistrationDrafts()
const collectionFragmentCaptureInputs = getAllZiweiDataCollectionFragmentCaptureInputs()
const collectionCleaningInputDrafts = getAllZiweiDataCollectionCleaningInputDrafts()
const collectionReviewQueueItemDrafts = getAllZiweiDataCollectionReviewQueueItemDrafts()
const collectionJobDrafts = getAllZiweiDataCollectionJobDrafts()
const collectionRunBatches = getAllZiweiDataCollectionRunBatches()
const collectionRunResultDrafts = getAllZiweiDataCollectionRunResultDrafts()
const collectionJobBlockRecords = getAllZiweiDataCollectionJobBlockRecords()
const collectionAuditRecords = getAllZiweiDataCollectionAuditRecords()
const collectionSourceResultCandidates = getAllZiweiDataCollectionSourceResultCandidates()
const collectionFragmentResultCandidates = getAllZiweiDataCollectionFragmentResultCandidates()
const collectionCleanedResultCandidates = getAllZiweiDataCollectionCleanedResultCandidates()
const collectionTopicMappingCandidates = getAllZiweiDataCollectionTopicMappingCandidates()
const collectionAdmissionDecisionCandidates = getAllZiweiDataCollectionAdmissionDecisionCandidates()
const collectionReviewRouteCandidates = getAllZiweiDataCollectionReviewRouteCandidates()
const collectionPromotionGateProfiles = getAllZiweiDataCollectionPromotionGateProfiles()
const collectionPromotionDecisionRecords = getAllZiweiDataCollectionPromotionDecisionRecords()
const sources = getAllZiweiExternalDataSourceRecords()
const fragments = getAllZiweiRawIntakeFragmentSlots()
const mappings = getAllZiweiDataTopicMappings()
const dictionaryMappingProfiles = getAllZiweiDataDictionaryTopicMappingProfiles()
const admissionPolicyProfiles = getAllZiweiDataDictionaryAdmissionPolicyProfiles()
const admissionDecisionRecords = getAllZiweiDataDictionaryAdmissionDecisionRecords()
const scoreRules = getAllZiweiDataUsabilityScoreRules()
const boundaryProfiles = getAllZiweiDataSourceStorageBoundaryProfiles()
const dedupProfiles = getAllZiweiDataDedupProfiles()
const entityExtractionProfiles = getAllZiweiDataEntityExtractionProfiles()
const conflictSignalProfiles = getAllZiweiDataConflictSignalProfiles()
const ziweiReviewQueueProfiles = getAllZiweiDataReviewQueueProfiles()
const cleanedResultRecords = getAllZiweiDataCleanedIntakeResultRecords()
const cleaningPipelineProfiles = getAllZiweiDataCleaningPipelineProfiles()
const cleaningPipelineScenarios = getAllZiweiDataCleaningPipelineScenarios()
const destinyDomainProfiles = getAllDestinyContentIntakeDomainProfiles()
const commonReviewQueueProfiles = getAllDestinyCommonReviewQueueProfiles()
const directoryRules = getAllDestinyContentIntakeDirectoryRules()

const expectedStages = ["P35-A", "P35-B", "P35-C", "P35-D", "P35-E", "P35-F"]
assert(plans.length === expectedStages.length, `expected ${expectedStages.length} stage plans`)
for (const stage of expectedStages) {
  const plan = plans.find((item) => item.stage === stage)
  assert(plan, `missing stage plan: ${stage}`)
  assert(plan.deliverables.length >= 3, `${stage} deliverables too short`)
  assert(plan.acceptanceChecks.length >= 3, `${stage} acceptance checks too short`)
}
assert(plans.find((plan) => plan.stage === "P35-A")?.status === "completed", "P35-A must be completed")
assert(plans.find((plan) => plan.stage === "P35-B")?.status === "completed", "P35-B must be completed")
assert(plans.find((plan) => plan.stage === "P35-C")?.status === "completed", "P35-C must be completed")
assert(plans.find((plan) => plan.stage === "P35-D")?.status === "completed", "P35-D must be completed")
assert(plans.find((plan) => plan.stage === "P35-E")?.status === "completed", "P35-E must be completed")
assert(plans.find((plan) => plan.stage === "P35-F")?.status === "completed", "P35-F must be completed")

assert(closureReports.length >= 4, `expected at least 4 closure reports, got ${closureReports.length}`)
const p35cClosure = closureReports.find((report) => report.stage === "P35-C")
assert(p35cClosure, "missing P35-C closure report")
assert(p35cClosure.status === "completed", "P35-C closure report must be completed")
assert(p35cClosure.nextStage === "P35-D", "P35-C closure report must point to P35-D")
assert(p35cClosure.closedScope.length >= 3, "P35-C closure report closedScope too short")
assert(p35cClosure.acceptanceEvidence.length >= 3, "P35-C closure report acceptanceEvidence too short")
assert(p35cClosure.remainingBoundary.length >= 3, "P35-C closure report remainingBoundary too short")
assert(
  p35cClosure.validationCommands.includes("node scripts/ziwei/check-p35-data-intake.mjs"),
  "P35-C closure report must include p35 check command"
)
const p35dClosure = closureReports.find((report) => report.stage === "P35-D")
assert(p35dClosure, "missing P35-D closure report")
assert(p35dClosure.status === "completed", "P35-D closure report must be completed")
assert(p35dClosure.nextStage === "P35-E", "P35-D closure report must point to P35-E")
assert(p35dClosure.closedScope.length >= 3, "P35-D closure report closedScope too short")
assert(p35dClosure.acceptanceEvidence.length >= 3, "P35-D closure report acceptanceEvidence too short")
assert(p35dClosure.remainingBoundary.length >= 3, "P35-D closure report remainingBoundary too short")
assert(
  p35dClosure.validationCommands.includes("node scripts/ziwei/check-p35-data-intake.mjs"),
  "P35-D closure report must include p35 check command"
)
const p35eClosure = closureReports.find((report) => report.stage === "P35-E")
assert(p35eClosure, "missing P35-E closure report")
assert(p35eClosure.status === "completed", "P35-E closure report must be completed")
assert(p35eClosure.nextStage === "P35-F", "P35-E closure report must point to P35-F")
assert(p35eClosure.closedScope.length >= 3, "P35-E closure report closedScope too short")
assert(p35eClosure.acceptanceEvidence.length >= 3, "P35-E closure report acceptanceEvidence too short")
assert(p35eClosure.remainingBoundary.length >= 3, "P35-E closure report remainingBoundary too short")
assert(
  p35eClosure.validationCommands.includes("node scripts/ziwei/check-p35-data-intake.mjs"),
  "P35-E closure report must include p35 check command"
)
const p35fClosure = closureReports.find((report) => report.stage === "P35-F")
assert(p35fClosure, "missing P35-F closure report")
assert(p35fClosure.status === "completed", "P35-F closure report must be completed")
assert(p35fClosure.nextStage === "P35-F", "P35-F closure report must self-close final stage")
assert(p35fClosure.closedScope.length >= 3, "P35-F closure report closedScope too short")
assert(p35fClosure.acceptanceEvidence.length >= 3, "P35-F closure report acceptanceEvidence too short")
assert(p35fClosure.remainingBoundary.length >= 3, "P35-F closure report remainingBoundary too short")
assert(
  p35fClosure.validationCommands.includes("node scripts/ziwei/check-p35-data-intake.mjs"),
  "P35-F closure report must include p35 check command"
)

const expectedSourceKinds = [
  "classic-public-domain",
  "classic-index",
  "university-library-catalog",
  "modern-book-metadata",
  "website-metadata",
  "video-metadata",
  "software-reference-metadata",
  "forum-thread-metadata",
  "manual-sample",
  "project-original"
]

assert(sources.length >= expectedSourceKinds.length, `expected at least ${expectedSourceKinds.length} external source records, got ${sources.length}`)
for (const sourceKind of expectedSourceKinds) {
  assert(sources.some((source) => source.sourceKind === sourceKind), `missing external source kind: ${sourceKind}`)
}
assert(
  sources.some((source) => source.sourceId === "p36.source.ziwei-my-website-index"),
  "missing P36 ziwei.my website source index"
)
for (const source of sources) {
  assert(
    source.sourceId.startsWith("p35.source.") ||
      source.sourceId.startsWith("p36.source."),
    `invalid source id: ${source.sourceId}`
  )
  assert(source.allowedStorage.length > 0, `${source.sourceId} missing allowedStorage`)
  assert(source.blockedStorage.length > 0, `${source.sourceId} missing blockedStorage`)
  if (
    source.sourceKind !== "classic-public-domain" &&
    source.sourceKind !== "manual-sample" &&
    source.sourceKind !== "project-original"
  ) {
    assert(
      source.storagePolicy === "metadata-only",
      `${source.sourceId} must remain metadata-only`
    )
  }
}

assert(
  boundaryProfiles.length === expectedSourceKinds.length,
  `expected ${expectedSourceKinds.length} storage boundary profiles, got ${boundaryProfiles.length}`
)
for (const sourceKind of expectedSourceKinds) {
  const profile = boundaryProfiles.find((item) => item.sourceKind === sourceKind)
  assert(profile, `missing boundary profile: ${sourceKind}`)
  assert(profile.profileId.startsWith("p35.boundary."), `${sourceKind} profile id must use p35.boundary prefix`)
  assert(profile.requiredMetadataFields.length >= 4, `${sourceKind} profile metadata fields too short`)
  assert(profile.allowedFields.length >= 4, `${sourceKind} profile allowedFields too short`)
  assert(profile.blockedFields.length >= 3, `${sourceKind} profile blockedFields too short`)
  assert(profile.promotionPath.length >= 3, `${sourceKind} profile promotionPath too short`)
  assert(profile.rejectionSignals.length >= 3, `${sourceKind} profile rejectionSignals too short`)
  if (sourceKind !== "classic-public-domain" && sourceKind !== "manual-sample" && sourceKind !== "project-original") {
    assert(!profile.canStoreOriginalText, `${sourceKind} must not store original text`)
  }
}
assert(
  boundaryProfiles.find((item) => item.sourceKind === "classic-public-domain")?.canStoreOriginalText,
  "classic-public-domain must allow original public-domain text"
)
assert(
  boundaryProfiles.find((item) => item.sourceKind === "modern-book-metadata")?.storagePolicy === "metadata-only",
  "modern-book-metadata must remain metadata-only"
)
for (const profile of boundaryProfiles) {
  assert(
    profile.domainScope.includes("ziwei") || profile.domainScope.includes("all"),
    `${profile.profileId} must be scoped to ziwei or all`
  )
}

assert(dedupProfiles.length >= 4, `expected at least 4 dedup profiles, got ${dedupProfiles.length}`)
for (const profile of dedupProfiles) {
  assert(profile.domainScope.includes("ziwei"), `${profile.profileId} must be scoped to ziwei`)
  assert(profile.dedupKeyTemplate.includes("ziwei:"), `${profile.profileId} dedup key must include domain`)
  assert(profile.normalizedFields.length >= 4, `${profile.profileId} normalizedFields too short`)
  assert(profile.conflictSignals.length >= 2, `${profile.profileId} conflictSignals too short`)
}

assert(
  entityExtractionProfiles.length >= 4,
  `expected at least 4 entity extraction profiles, got ${entityExtractionProfiles.length}`
)
for (const profile of entityExtractionProfiles) {
  assert(profile.domain === "ziwei", `${profile.profileId} must be ziwei domain`)
  assert(profile.requiredEntities.length >= 2, `${profile.profileId} requiredEntities too short`)
  assert(profile.normalizationRules.length >= 3, `${profile.profileId} normalizationRules too short`)
}

assert(
  conflictSignalProfiles.length >= 4,
  `expected at least 4 conflict signal profiles, got ${conflictSignalProfiles.length}`
)
for (const profile of conflictSignalProfiles) {
  assert(profile.domainScope.includes("ziwei"), `${profile.signalId} must be scoped to ziwei`)
  assert(profile.routingQueueId.length > 0, `${profile.signalId} missing routingQueueId`)
}

assert(
  ziweiReviewQueueProfiles.length >= 2,
  `expected at least 2 ziwei review queue profiles, got ${ziweiReviewQueueProfiles.length}`
)
for (const profile of ziweiReviewQueueProfiles) {
  assert(profile.domainScope.includes("ziwei"), `${profile.queueId} must be scoped to ziwei`)
  assert(profile.requiredReviewFields.length >= 5, `${profile.queueId} requiredReviewFields too short`)
  assert(profile.promotionCriteria.length >= 3, `${profile.queueId} promotionCriteria too short`)
}

assert(
  cleanedResultRecords.length >= 4,
  `expected at least 4 cleaned result records, got ${cleanedResultRecords.length}`
)
const dedupProfileIds = new Set(dedupProfiles.map((profile) => profile.profileId))
const conflictSignalIds = new Set(conflictSignalProfiles.map((profile) => profile.signalId))
const reviewQueueIds = new Set([
  ...ziweiReviewQueueProfiles.map((profile) => profile.queueId),
  ...commonReviewQueueProfiles.map((profile) => profile.queueId)
])
const promotionStatuses = new Set(cleanedResultRecords.map((record) => record.promotionStatus))
assert(promotionStatuses.has("ready-for-dictionary"), "cleaned records must include ready-for-dictionary")
assert(promotionStatuses.has("needs-review"), "cleaned records must include needs-review")
assert(promotionStatuses.has("blocked"), "cleaned records must include blocked")
for (const record of cleanedResultRecords) {
  assert(record.domain === "ziwei", `${record.resultId} must be ziwei domain`)
  assert(record.resultId.startsWith("p35.cleaned."), `${record.resultId} must use p35.cleaned prefix`)
  assert(record.dedupKey.includes("ziwei:"), `${record.resultId} dedupKey must include domain`)
  assert(dedupProfileIds.has(record.dedupProfileId), `${record.resultId} references unknown dedup profile`)
  assert(record.entityRefs.length >= 1, `${record.resultId} missing entityRefs`)
  assert(record.topicTags.length >= 1, `${record.resultId} missing topicTags`)
  assert(Object.keys(record.normalizedFields).length >= 4, `${record.resultId} normalizedFields too short`)
  assert(record.auditTrail.length >= 3, `${record.resultId} auditTrail too short`)
  if (record.reviewQueueId !== null) {
    assert(reviewQueueIds.has(record.reviewQueueId), `${record.resultId} references unknown reviewQueueId`)
  }
  for (const conflictSignalId of record.conflictSignalIds) {
    assert(conflictSignalIds.has(conflictSignalId), `${record.resultId} references unknown conflict signal`)
  }
  if (record.promotionStatus === "blocked") {
    assert(record.rejectionReason, `${record.resultId} blocked record must include rejectionReason`)
    assert(record.targetDictionaryLayer === null, `${record.resultId} blocked record must not target dictionary`)
  }
  if (record.promotionStatus === "ready-for-dictionary") {
    assert(record.targetDictionaryLayer, `${record.resultId} ready record must target dictionary`)
  }
}

assert(
  cleaningPipelineProfiles.length >= 1,
  `expected at least 1 cleaning pipeline profile, got ${cleaningPipelineProfiles.length}`
)
const requiredPipelineKinds = [
  "source-registration",
  "storage-boundary",
  "entity-extraction",
  "deduplication",
  "conflict-detection",
  "review-routing",
  "cleaned-result"
]
const ziweiPipeline = cleaningPipelineProfiles.find((pipeline) => pipeline.pipelineId === "p35.pipeline.ziwei-cleaning-v1")
assert(ziweiPipeline, "missing ziwei cleaning pipeline v1")
assert(ziweiPipeline.domain === "ziwei", "ziwei cleaning pipeline must use ziwei domain")
assert(
  expectedSourceKinds.every((sourceKind) => ziweiPipeline.sourceKinds.includes(sourceKind)),
  "ziwei cleaning pipeline must cover all source kinds"
)
assert(
  ziweiPipeline.steps.length === requiredPipelineKinds.length,
  `ziwei cleaning pipeline must contain ${requiredPipelineKinds.length} steps`
)
const sortedSteps = [...ziweiPipeline.steps].sort((left, right) => left.order - right.order)
for (let index = 0; index < requiredPipelineKinds.length; index += 1) {
  const step = sortedSteps[index]
  assert(step.order === index + 1, `${step.stepId} has invalid order`)
  assert(step.kind === requiredPipelineKinds[index], `${step.stepId} expected kind ${requiredPipelineKinds[index]}`)
  assert(step.inputRefs.length >= 3, `${step.stepId} inputRefs too short`)
  assert(step.outputRefs.length >= 2, `${step.stepId} outputRefs too short`)
  assert(step.requiredChecks.length >= 3, `${step.stepId} requiredChecks too short`)
}
for (const output of ["dedupKey", "entityRefs", "conflictSignalIds", "reviewQueueId", "promotionStatus", "auditTrail"]) {
  assert(ziweiPipeline.finalOutputs.includes(output), `ziwei cleaning pipeline missing final output: ${output}`)
}
assert(
  ziweiPipeline.forbiddenShortcuts.some((item) => item.includes("来源登记")),
  "ziwei cleaning pipeline must forbid skipping source registration"
)
assert(
  ziweiPipeline.forbiddenShortcuts.some((item) => item.includes("现代资料正文")),
  "ziwei cleaning pipeline must forbid modern source body ingestion"
)

assert(
  cleaningPipelineScenarios.length === expectedSourceKinds.length,
  `expected ${expectedSourceKinds.length} cleaning pipeline scenarios, got ${cleaningPipelineScenarios.length}`
)
const scenarioSourceKinds = new Set(cleaningPipelineScenarios.map((scenario) => scenario.sourceKind))
for (const sourceKind of expectedSourceKinds) {
  assert(scenarioSourceKinds.has(sourceKind), `missing cleaning scenario for source kind: ${sourceKind}`)
}
const allowedPromotionStatuses = new Set(["blocked", "metadata-only", "needs-review", "ready-for-dictionary"])
const allowedReviewStatuses = new Set([
  "queued",
  "collected-metadata",
  "needs-dedup",
  "needs-source-review",
  "needs-conflict-review",
  "approved-for-dictionary",
  "rejected"
])
for (const scenario of cleaningPipelineScenarios) {
  assert(scenario.scenarioId.startsWith("p35.scenario."), `${scenario.scenarioId} must use p35.scenario prefix`)
  assert(scenario.pipelineId === ziweiPipeline.pipelineId, `${scenario.scenarioId} must reference ziwei pipeline`)
  assert(scenario.domain === "ziwei", `${scenario.scenarioId} must be ziwei domain`)
  assert(scenario.expectedStepKinds.join("|") === requiredPipelineKinds.join("|"), `${scenario.scenarioId} step kinds mismatch`)
  assert(allowedPromotionStatuses.has(scenario.expectedPromotionStatus), `${scenario.scenarioId} invalid promotion status`)
  assert(allowedReviewStatuses.has(scenario.expectedReviewStatus), `${scenario.scenarioId} invalid review status`)
  if (scenario.expectedReviewQueueId !== null) {
    assert(reviewQueueIds.has(scenario.expectedReviewQueueId), `${scenario.scenarioId} references unknown review queue`)
  }
  for (const conflictSignalId of scenario.expectedConflictSignalIds) {
    assert(conflictSignalIds.has(conflictSignalId), `${scenario.scenarioId} references unknown conflict signal`)
  }
  for (const outputField of ["dedupKey", "entityRefs", "conflictSignalIds", "promotionStatus", "auditTrail"]) {
    assert(scenario.expectedOutputFields.includes(outputField), `${scenario.scenarioId} missing output field: ${outputField}`)
  }
  assert(scenario.notes.length >= 2, `${scenario.scenarioId} notes too short`)
}

assert(
  destinyDomainProfiles.some((profile) => profile.domain === "ziwei"),
  "common destiny intake contract must include ziwei domain"
)
assert(
  destinyDomainProfiles.some((profile) => profile.domain === "bazi"),
  "common destiny intake contract must include bazi domain"
)
assert(
  commonReviewQueueProfiles.length >= 3,
  `expected at least 3 common review queues, got ${commonReviewQueueProfiles.length}`
)

const expectedDirectoryRuleIds = [
  "destiny.directory.common-contract",
  "destiny.directory.ziwei-profile",
  "destiny.directory.bazi-existing-core",
  "destiny.directory.ziwei-check",
  "destiny.directory.ziwei-docs"
]
assert(
  directoryRules.length === expectedDirectoryRuleIds.length,
  `expected ${expectedDirectoryRuleIds.length} directory rules, got ${directoryRules.length}`
)
for (const ruleId of expectedDirectoryRuleIds) {
  const rule = directoryRules.find((item) => item.ruleId === ruleId)
  assert(rule, `missing directory rule: ${ruleId}`)
  assert(rule.path.length > 0, `${ruleId} missing path`)
  assert(rule.purpose.length > 0, `${ruleId} missing purpose`)
  assert(rule.allowedFiles.length > 0, `${ruleId} missing allowedFiles`)
  assert(rule.forbiddenPatterns.length > 0, `${ruleId} missing forbiddenPatterns`)
  assert(rule.extensionRule.length > 0, `${ruleId} missing extensionRule`)
}
const commonContractRule = directoryRules.find((item) => item.ruleId === "destiny.directory.common-contract")
assert(
  commonContractRule?.allowedFiles.join("|") === "content-intake-contract.ts",
  "common contract directory must only allow content-intake-contract.ts"
)
assert(
  commonContractRule?.forbiddenPatterns.includes("index.ts"),
  "common contract directory must forbid index.ts"
)
assert(
  directoryRules.find((item) => item.ruleId === "destiny.directory.bazi-existing-core")?.path ===
    "src/ai/destiny-core/bazi-core/",
  "bazi extension must point at existing bazi-core"
)

assert(fragments.length >= 3, `expected at least 3 fragment slots, got ${fragments.length}`)
for (const fragment of fragments) {
  assert(fragment.originalTextStoragePolicy !== "short-quote-only", `${fragment.fragmentId} stores quotes too early`)
  assert(fragment.normalizedSummary.length > 0, `${fragment.fragmentId} missing normalizedSummary`)
  assert(fragment.dedupKey.includes("{sourceId}"), `${fragment.fragmentId} dedupKey must include sourceId`)
}

assert(mappings.length >= 4, `expected at least 4 topic mappings, got ${mappings.length}`)
for (const mapping of mappings) {
  assert(mapping.requiredFields.includes("sourceId"), `${mapping.mappingId} must require sourceId`)
  assert(mapping.usageBoundary.length >= 2, `${mapping.mappingId} usage boundary too short`)
}

const expectedTopicTags = [
  "star",
  "palace",
  "branch",
  "stem",
  "element-gate",
  "pattern",
  "transformation",
  "brightness",
  "dynamic-flow",
  "relationship",
  "sample",
  "storage-boundary"
]
assert(
  dictionaryMappingProfiles.length === expectedTopicTags.length,
  `expected ${expectedTopicTags.length} dictionary topic mapping profiles, got ${dictionaryMappingProfiles.length}`
)
const dictionaryMappingTopicTags = new Set(dictionaryMappingProfiles.map((profile) => profile.topicTag))
for (const topicTag of expectedTopicTags) {
  assert(dictionaryMappingTopicTags.has(topicTag), `missing dictionary topic mapping profile for topic: ${topicTag}`)
}
const expectedCleanedTraceFields = ["sourceId", "fragmentId", "dedupKey", "entityRefs", "promotionStatus"]
const knownSourceKinds = new Set(expectedSourceKinds)
for (const profile of dictionaryMappingProfiles) {
  assert(profile.mappingProfileId.startsWith("p35.dictionary-mapping."), `${profile.mappingProfileId} must use p35.dictionary-mapping prefix`)
  assert(profile.domain === "ziwei", `${profile.mappingProfileId} must be ziwei domain`)
  assert(profile.label.length > 0, `${profile.mappingProfileId} missing label`)
  assert(profile.entityKinds.length >= 2, `${profile.mappingProfileId} entityKinds too short`)
  assert(profile.sourceKinds.length >= 1, `${profile.mappingProfileId} sourceKinds missing`)
  assert(profile.targetDictionaryLayer.length > 0, `${profile.mappingProfileId} missing targetDictionaryLayer`)
  assert(profile.requiredCleanedFields.length >= 6, `${profile.mappingProfileId} requiredCleanedFields too short`)
  assert(profile.sourceTraceFields.length >= 5, `${profile.mappingProfileId} sourceTraceFields too short`)
  assert(profile.acceptanceRules.length >= 3, `${profile.mappingProfileId} acceptanceRules too short`)
  assert(profile.rejectionRules.length >= 2, `${profile.mappingProfileId} rejectionRules too short`)
  assert(profile.downstreamUse.length >= 2, `${profile.mappingProfileId} downstreamUse too short`)
  for (const field of expectedCleanedTraceFields) {
    assert(
      profile.requiredCleanedFields.includes(field) || profile.sourceTraceFields.includes(field),
      `${profile.mappingProfileId} must trace ${field}`
    )
  }
  for (const sourceKind of profile.sourceKinds) {
    assert(knownSourceKinds.has(sourceKind), `${profile.mappingProfileId} references unknown source kind: ${sourceKind}`)
  }
}
assert(
  dictionaryMappingProfiles.find((profile) => profile.topicTag === "brightness")?.rejectionRules.some((rule) => rule.includes("four transformations")),
  "brightness mapping must reject treating transformations as brightness"
)
assert(
  dictionaryMappingProfiles.find((profile) => profile.topicTag === "dynamic-flow")?.acceptanceRules.some((rule) => rule.includes("liuNian")),
  "dynamic-flow mapping must cover flow layers"
)

const totalPositiveScore = scoreRules
  .filter((rule) => rule.scoreDelta > 0)
  .reduce((sum, rule) => sum + rule.scoreDelta, 0)
const hasBlockingRule = scoreRules.some((rule) => rule.scoreDelta <= -100)
assert(totalPositiveScore >= 70, "positive score rules must allow useful material selection")
assert(hasBlockingRule, "score rules must include a storage blocking rule")

const expectedAdmissionPolicyIds = [
  "p35.admission.public-domain-ready",
  "p35.admission.metadata-index-only",
  "p35.admission.topic-review-required",
  "p35.admission.dynamic-flow-review-required",
  "p35.admission.blocked"
]
assert(
  admissionPolicyProfiles.length === expectedAdmissionPolicyIds.length,
  `expected ${expectedAdmissionPolicyIds.length} admission policies, got ${admissionPolicyProfiles.length}`
)
const admissionPolicyById = new Map(admissionPolicyProfiles.map((policy) => [policy.policyId, policy]))
for (const policyId of expectedAdmissionPolicyIds) {
  assert(admissionPolicyById.has(policyId), `missing admission policy: ${policyId}`)
}
const allowedAdmissionStatuses = new Set(["admitted", "metadata-only", "review-required", "rejected"])
for (const policy of admissionPolicyProfiles) {
  assert(policy.domain === "ziwei", `${policy.policyId} must be ziwei domain`)
  assert(allowedAdmissionStatuses.has(policy.admissionStatus), `${policy.policyId} invalid admissionStatus`)
  assert(policy.minScoreInclusive <= policy.maxScoreInclusive, `${policy.policyId} score range invalid`)
  assert(policy.appliesToPromotionStatuses.length >= 1, `${policy.policyId} missing promotion statuses`)
  assert(policy.appliesToStoragePolicies.length >= 1, `${policy.policyId} missing storage policies`)
  assert(policy.requiredEvidenceFields.length >= 5, `${policy.policyId} requiredEvidenceFields too short`)
  assert(policy.blockingSignals.length >= 3, `${policy.policyId} blockingSignals too short`)
  assert(policy.outputFields.length >= 3, `${policy.policyId} outputFields too short`)
  if (policy.admissionStatus === "admitted") {
    assert(policy.allowedTargetDictionaryLayers.length >= 3, `${policy.policyId} admitted policy must allow dictionary layers`)
    assert(policy.requiredReviewQueueIds.length === 0, `${policy.policyId} admitted policy must not require review queue`)
  }
  if (policy.admissionStatus === "review-required") {
    assert(policy.requiredReviewQueueIds.length >= 1, `${policy.policyId} review policy must require review queue`)
    assert(policy.allowedTargetDictionaryLayers.length >= 1, `${policy.policyId} review policy must allow target layers`)
  }
  if (policy.admissionStatus === "rejected") {
    assert(policy.allowedTargetDictionaryLayers.length === 0, `${policy.policyId} rejected policy must not allow target layers`)
  }
}

assert(
  admissionDecisionRecords.length >= cleanedResultRecords.length,
  `expected at least ${cleanedResultRecords.length} admission decisions, got ${admissionDecisionRecords.length}`
)
const cleanedResultById = new Map(cleanedResultRecords.map((record) => [record.resultId, record]))
const admissionStatuses = new Set(admissionDecisionRecords.map((decision) => decision.admissionStatus))
assert(admissionStatuses.has("admitted"), "admission decisions must include admitted")
assert(admissionStatuses.has("review-required"), "admission decisions must include review-required")
assert(admissionStatuses.has("rejected"), "admission decisions must include rejected")
for (const decision of admissionDecisionRecords) {
  const policy = admissionPolicyById.get(decision.policyId)
  const cleanedResult = cleanedResultById.get(decision.cleanedResultId)
  assert(decision.decisionId.startsWith("p35.admission-decision."), `${decision.decisionId} must use p35.admission-decision prefix`)
  assert(decision.domain === "ziwei", `${decision.decisionId} must be ziwei domain`)
  assert(policy, `${decision.decisionId} references unknown policy`)
  assert(cleanedResult, `${decision.decisionId} references unknown cleaned result`)
  assert(policy.appliesToPromotionStatuses.includes(cleanedResult.promotionStatus), `${decision.decisionId} policy does not match cleaned promotion status`)
  assert(policy.appliesToStoragePolicies.includes(cleanedResult.storagePolicy), `${decision.decisionId} policy does not match storage policy`)
  assert(decision.score >= policy.minScoreInclusive && decision.score <= policy.maxScoreInclusive, `${decision.decisionId} score outside policy range`)
  assert(decision.admissionStatus === policy.admissionStatus, `${decision.decisionId} admissionStatus must match policy`)
  assert(decision.acceptedEvidenceFields.length >= 5, `${decision.decisionId} acceptedEvidenceFields too short`)
  assert(decision.nextAction.length > 0, `${decision.decisionId} missing nextAction`)
  assert(decision.auditTrail.length >= 3, `${decision.decisionId} auditTrail too short`)
  if (decision.targetDictionaryLayer !== null) {
    assert(
      policy.allowedTargetDictionaryLayers.includes(decision.targetDictionaryLayer),
      `${decision.decisionId} target layer is not allowed by policy`
    )
  }
  if (decision.admissionStatus === "review-required") {
    assert(decision.requiredReviewQueueId, `${decision.decisionId} review-required decision needs queue`)
    assert(policy.requiredReviewQueueIds.includes(decision.requiredReviewQueueId), `${decision.decisionId} review queue not allowed by policy`)
  }
  if (decision.admissionStatus === "rejected") {
    assert(decision.rejectionReason, `${decision.decisionId} rejected decision must include rejectionReason`)
    assert(decision.targetDictionaryLayer === null, `${decision.decisionId} rejected decision must not target dictionary`)
  }
}

const expectedAnalysisUsageIds = [
  "p35.analysis.star-dictionary-detail",
  "p35.analysis.chart-hit-star-reading",
  "p35.analysis.pattern-hit-reading",
  "p35.analysis.dynamic-flow-reading",
  "p35.analysis.rejected-source-audit"
]
assert(
  analysisUsageProfiles.length === expectedAnalysisUsageIds.length,
  `expected ${expectedAnalysisUsageIds.length} analysis usage profiles, got ${analysisUsageProfiles.length}`
)
const analysisUsageById = new Map(analysisUsageProfiles.map((profile) => [profile.usageId, profile]))
for (const usageId of expectedAnalysisUsageIds) {
  assert(analysisUsageById.has(usageId), `missing analysis usage profile: ${usageId}`)
}
const knownAdmissionStatuses = new Set(["admitted", "metadata-only", "review-required", "rejected"])
const knownTargetLayers = new Set([
  ...dictionaryMappingProfiles.map((profile) => profile.targetDictionaryLayer),
  ...admissionPolicyProfiles.flatMap((policy) => policy.allowedTargetDictionaryLayers)
])
const allowedPageVisibility = new Set(["dictionary-only", "chart-hit-only", "review-panel", "hidden"])
for (const profile of analysisUsageProfiles) {
  assert(profile.usageId.startsWith("p35.analysis."), `${profile.usageId} must use p35.analysis prefix`)
  assert(profile.label.length > 0, `${profile.usageId} missing label`)
  assert(profile.inputAdmissionStatuses.length >= 1, `${profile.usageId} missing inputAdmissionStatuses`)
  assert(profile.targetDictionaryLayers.length >= 1, `${profile.usageId} missing targetDictionaryLayers`)
  assert(profile.analysisFields.length >= 4, `${profile.usageId} analysisFields too short`)
  assert(allowedPageVisibility.has(profile.pageVisibility), `${profile.usageId} invalid pageVisibility`)
  assert(profile.chartHitRequirement.length >= 2, `${profile.usageId} chartHitRequirement too short`)
  assert(profile.requiredSourceTrace.length >= 3, `${profile.usageId} requiredSourceTrace too short`)
  assert(profile.forbiddenUse.length >= 2, `${profile.usageId} forbiddenUse too short`)
  assert(profile.outputRefs.length >= 2, `${profile.usageId} outputRefs too short`)
  for (const status of profile.inputAdmissionStatuses) {
    assert(knownAdmissionStatuses.has(status), `${profile.usageId} references unknown admission status: ${status}`)
  }
  for (const targetLayer of profile.targetDictionaryLayers) {
    assert(knownTargetLayers.has(targetLayer), `${profile.usageId} references unknown target layer: ${targetLayer}`)
  }
  if (profile.pageVisibility === "chart-hit-only") {
    assert(
      profile.inputAdmissionStatuses.join("|") === "admitted",
      `${profile.usageId} chart-hit-only output must only use admitted material`
    )
  }
  if (profile.pageVisibility === "hidden") {
    assert(
      profile.inputAdmissionStatuses.includes("rejected"),
      `${profile.usageId} hidden audit profile must cover rejected material`
    )
  }
}

const expectedCollectionFieldIds = [
  "p35.collection-field.source-identity",
  "p35.collection-field.locator",
  "p35.collection-field.storage-boundary",
  "p35.collection-field.topic-entity",
  "p35.collection-field.audit-review"
]
assert(
  collectionFieldProfiles.length === expectedCollectionFieldIds.length,
  `expected ${expectedCollectionFieldIds.length} collection field profiles, got ${collectionFieldProfiles.length}`
)
const collectionFieldById = new Map(collectionFieldProfiles.map((field) => [field.fieldId, field]))
for (const fieldId of expectedCollectionFieldIds) {
  assert(collectionFieldById.has(fieldId), `missing collection field profile: ${fieldId}`)
}
for (const field of collectionFieldProfiles) {
  assert(field.domainScope.includes("ziwei"), `${field.fieldId} must be scoped to ziwei`)
  assert(field.required, `${field.fieldId} must be required for first collection batch`)
  assert(field.mapsTo.length >= 2, `${field.fieldId} mapsTo too short`)
  assert(field.validationRules.length >= 3, `${field.fieldId} validationRules too short`)
  assert(field.forbiddenValues.length >= 3, `${field.fieldId} forbiddenValues too short`)
}

const expectedSeedIds = [
  "p35.seed.public-domain-classic",
  "p35.seed.university-library-catalog",
  "p35.seed.modern-book-metadata",
  "p35.seed.website-topic-summary",
  "p35.seed.video-topic-summary",
  "p35.seed.software-dynamic-flow",
  "p35.seed.manual-sample"
]
assert(sourceSeedRecords.length === expectedSeedIds.length, `expected ${expectedSeedIds.length} source seeds, got ${sourceSeedRecords.length}`)
const sourceSeedById = new Map(sourceSeedRecords.map((seed) => [seed.seedId, seed]))
const pipelineIds = new Set(cleaningPipelineProfiles.map((pipeline) => pipeline.pipelineId))
for (const seedId of expectedSeedIds) {
  assert(sourceSeedById.has(seedId), `missing source seed: ${seedId}`)
}
for (const seed of sourceSeedRecords) {
  assert(seed.domain === "ziwei", `${seed.seedId} must be ziwei domain`)
  assert(expectedSourceKinds.includes(seed.sourceKind), `${seed.seedId} references unknown source kind`)
  assert(seed.locatorTemplate.length > 0, `${seed.seedId} missing locatorTemplate`)
  assert(seed.allowedCaptureFields.length >= 4, `${seed.seedId} allowedCaptureFields too short`)
  assert(seed.forbiddenCaptureFields.length >= 3, `${seed.seedId} forbiddenCaptureFields too short`)
  assert(seed.expectedEntityKinds.length >= 3, `${seed.seedId} expectedEntityKinds too short`)
  assert(pipelineIds.has(seed.handoffPipelineId), `${seed.seedId} references unknown handoffPipelineId`)
  assert(seed.topicTags.every((topicTag) => expectedTopicTags.includes(topicTag)), `${seed.seedId} references unknown topic tag`)
  if (seed.storagePolicy === "metadata-only") {
    assert(
      seed.forbiddenCaptureFields.some((field) => field.includes("正文") || field.includes("截图") || field.includes("扫描图")),
      `${seed.seedId} metadata-only seed must forbid body or image capture`
    )
  }
}

const expectedCollectionBatchIds = [
  "p35.collection-batch.classic-dictionary-seed",
  "p35.collection-batch.catalog-metadata-seed",
  "p35.collection-batch.web-video-topic-review",
  "p35.collection-batch.dynamic-flow-sample-review"
]
assert(
  collectionBatchPlans.length === expectedCollectionBatchIds.length,
  `expected ${expectedCollectionBatchIds.length} collection batch plans, got ${collectionBatchPlans.length}`
)
const collectionBatchStatuses = new Set(collectionBatchPlans.map((batch) => batch.status))
const collectionBatchById = new Map(collectionBatchPlans.map((batch) => [batch.batchId, batch]))
assert(collectionBatchStatuses.has("ready"), "collection batches must include ready plans")
assert(collectionBatchStatuses.has("planned"), "collection batches must include planned plans")
for (const batchId of expectedCollectionBatchIds) {
  assert(collectionBatchPlans.some((batch) => batch.batchId === batchId), `missing collection batch: ${batchId}`)
}
for (const batch of collectionBatchPlans) {
  assert(batch.domain === "ziwei", `${batch.batchId} must be ziwei domain`)
  assert(batch.sourceSeedIds.length >= 1, `${batch.batchId} missing sourceSeedIds`)
  assert(batch.sourceKinds.length >= 1, `${batch.batchId} missing sourceKinds`)
  assert(batch.topicTags.length >= 3, `${batch.batchId} topicTags too short`)
  assert(batch.requiredFieldIds.length >= 4, `${batch.batchId} requiredFieldIds too short`)
  assert(batch.expectedOutputs.length >= 3, `${batch.batchId} expectedOutputs too short`)
  assert(batch.storageGuardrails.length >= 3, `${batch.batchId} storageGuardrails too short`)
  assert(batch.reviewGates.length >= 3, `${batch.batchId} reviewGates too short`)
  for (const seedId of batch.sourceSeedIds) {
    assert(sourceSeedById.has(seedId), `${batch.batchId} references unknown source seed: ${seedId}`)
  }
  for (const fieldId of batch.requiredFieldIds) {
    assert(collectionFieldById.has(fieldId), `${batch.batchId} references unknown collection field: ${fieldId}`)
  }
  for (const sourceKind of batch.sourceKinds) {
    assert(expectedSourceKinds.includes(sourceKind), `${batch.batchId} references unknown source kind: ${sourceKind}`)
  }
  for (const topicTag of batch.topicTags) {
    assert(expectedTopicTags.includes(topicTag), `${batch.batchId} references unknown topic tag: ${topicTag}`)
  }
  if (batch.automationMode === "automated") {
    assert(
      batch.storageGuardrails.some((guardrail) => guardrail.includes("只存元信息")),
      `${batch.batchId} automated batch must declare metadata-only guardrail`
    )
  }
}

const seedSourceKinds = Array.from(new Set(sourceSeedRecords.map((seed) => seed.sourceKind)))
const adapterSourceKinds = new Set(collectionAdapterProfiles.flatMap((adapter) => adapter.sourceKinds))
const expectedAdapterKinds = [
  "public-domain-text",
  "catalog-metadata",
  "book-metadata",
  "webpage-metadata",
  "video-metadata",
  "software-reference",
  "manual-sample"
]
assert(
  collectionAdapterProfiles.length === expectedAdapterKinds.length,
  `expected ${expectedAdapterKinds.length} collection adapters, got ${collectionAdapterProfiles.length}`
)
for (const adapterKind of expectedAdapterKinds) {
  assert(collectionAdapterProfiles.some((adapter) => adapter.adapterKind === adapterKind), `missing adapter kind: ${adapterKind}`)
}
for (const sourceKind of seedSourceKinds) {
  assert(adapterSourceKinds.has(sourceKind), `collection adapters missing seed source kind: ${sourceKind}`)
}
for (const adapter of collectionAdapterProfiles) {
  assert(adapter.domain === "ziwei", `${adapter.adapterId} must be ziwei domain`)
  assert(adapter.sourceKinds.length >= 1, `${adapter.adapterId} missing sourceKinds`)
  assert(adapter.automationModes.length >= 1, `${adapter.adapterId} missing automationModes`)
  assert(adapter.allowedStoragePolicies.length >= 1, `${adapter.adapterId} missing allowedStoragePolicies`)
  assert(adapter.produces.length >= 3, `${adapter.adapterId} produces too short`)
  assert(adapter.guardrails.length >= 3, `${adapter.adapterId} guardrails too short`)
  assert(adapter.blockedOperations.length >= 3, `${adapter.adapterId} blockedOperations too short`)
  if (adapter.requestMode === "metadata-only") {
    assert(
      adapter.blockedOperations.some((operation) =>
        operation.includes("fulltext") ||
        operation.includes("body") ||
        operation.includes("scan") ||
        operation.includes("screenshot") ||
        operation.includes("layout")
      ),
      `${adapter.adapterId} metadata-only adapter must block text, scan, screenshot or layout capture`
    )
  }
  if (adapter.requestMode === "own-summary-only") {
    assert(
      adapter.guardrails.some((guardrail) => guardrail.includes("自有摘要") || guardrail.includes("鎽樿")),
      `${adapter.adapterId} own-summary adapter must declare own summary guardrail`
    )
  }
}

const expectedExecutionStepKinds = [
  "load-batch",
  "register-source",
  "capture-fragment",
  "clean-fragment",
  "map-topic",
  "decide-admission",
  "route-review"
]
assert(collectionExecutorProfile.executorId === "p35.collection-executor.ziwei-v1", "missing ziwei collection executor")
assert(collectionExecutorProfile.domain === "ziwei", "collection executor must be ziwei domain")
for (const stepKind of expectedExecutionStepKinds) {
  assert(collectionExecutorProfile.stepKinds.includes(stepKind), `collection executor missing step: ${stepKind}`)
}
assert(collectionExecutorProfile.consumes.length >= 5, "collection executor consumes list too short")
assert(collectionExecutorProfile.produces.length >= 5, "collection executor produces list too short")
assert(collectionExecutorProfile.guardrails.length >= 4, "collection executor guardrails too short")
assert(collectionExecutorProfile.failureModes.length >= 4, "collection executor failureModes too short")

const expectedTaskCount = collectionBatchPlans.reduce((total, batch) => total + batch.sourceSeedIds.length, 0)
assert(
  collectionExecutionTaskRecords.length === expectedTaskCount,
  `expected ${expectedTaskCount} collection execution tasks, got ${collectionExecutionTaskRecords.length}`
)
const taskIds = new Set()
const sourceRegistrationByTaskId = new Map(collectionSourceRegistrationDrafts.map((item) => [item.taskId, item]))
const captureInputByTaskId = new Map(collectionFragmentCaptureInputs.map((item) => [item.taskId, item]))
const cleaningInputByTaskId = new Map(collectionCleaningInputDrafts.map((item) => [item.taskId, item]))
const reviewItemByTaskId = new Map(collectionReviewQueueItemDrafts.map((item) => [item.taskId, item]))
const adapterBySourceKind = new Map(
  collectionAdapterProfiles.flatMap((adapter) => adapter.sourceKinds.map((sourceKind) => [sourceKind, adapter]))
)
const collectionJobByTaskId = new Map(collectionJobDrafts.map((job) => [job.taskId, job]))
assert(
  collectionSourceRegistrationDrafts.length === collectionExecutionTaskRecords.length,
  "each collection task must produce one source registration draft"
)
assert(
  collectionFragmentCaptureInputs.length === collectionExecutionTaskRecords.length,
  "each collection task must produce one fragment capture input"
)
assert(
  collectionCleaningInputDrafts.length === collectionExecutionTaskRecords.length,
  "each collection task must produce one cleaning input draft"
)
assert(
  collectionJobDrafts.length === collectionExecutionTaskRecords.length,
  "each collection task must produce one collection job draft"
)
for (const task of collectionExecutionTaskRecords) {
  assert(!taskIds.has(task.taskId), `duplicate collection task: ${task.taskId}`)
  taskIds.add(task.taskId)
  assert(task.taskId.startsWith("p35.collection-batch."), `${task.taskId} must use collection-batch prefix`)
  assert(task.domain === "ziwei", `${task.taskId} must be ziwei domain`)
  const batch = collectionBatchById.get(task.batchId)
  assert(batch, `${task.taskId} references unknown batch: ${task.batchId}`)
  const seed = sourceSeedById.get(task.sourceSeedId)
  assert(seed, `${task.taskId} references unknown seed: ${task.sourceSeedId}`)
  assert(batch.sourceSeedIds.includes(task.sourceSeedId), `${task.taskId} seed must belong to batch`)
  assert(task.sourceKind === seed.sourceKind, `${task.taskId} sourceKind must follow seed`)
  assert(task.automationMode === batch.automationMode, `${task.taskId} automationMode must follow batch`)
  assert(task.stepKind === "register-source", `${task.taskId} initial step must be register-source`)
  assert(task.nextStepKind === "capture-fragment", `${task.taskId} next step must be capture-fragment`)
  assert(task.requiredFieldIds.length === batch.requiredFieldIds.length, `${task.taskId} required fields mismatch`)
  assert(task.expectedOutputs.length === batch.expectedOutputs.length, `${task.taskId} expected outputs mismatch`)
  assert(task.allowedCaptureFields.length === seed.allowedCaptureFields.length, `${task.taskId} allowed fields mismatch`)
  assert(task.forbiddenCaptureFields.length === seed.forbiddenCaptureFields.length, `${task.taskId} forbidden fields mismatch`)
  assert(task.storageGuardrails.length === batch.storageGuardrails.length, `${task.taskId} guardrails mismatch`)
  assert(task.auditTrail.some((item) => item === `batch:${batch.batchId}`), `${task.taskId} missing batch audit`)
  assert(task.auditTrail.some((item) => item === `seed:${seed.seedId}`), `${task.taskId} missing seed audit`)
  assert(task.auditTrail.some((item) => item === `pipeline:${seed.handoffPipelineId}`), `${task.taskId} missing pipeline audit`)
  if (batch.status === "ready" || batch.status === "running") {
    assert(task.status === "ready", `${task.taskId} ready batch must produce ready task`)
  }
  if (batch.status === "planned") {
    assert(task.status === "queued", `${task.taskId} planned batch must produce queued task`)
  }
  if (seed.reviewQueueId) {
    assert(reviewQueueIds.has(seed.reviewQueueId), `${task.taskId} references unknown review queue`)
    assert(task.reviewQueueId === seed.reviewQueueId, `${task.taskId} reviewQueueId must follow seed`)
  }
  if (seed.storagePolicy === "metadata-only") {
    assert(task.storageGuardrails.length >= 3, `${task.taskId} metadata-only task must keep guardrails`)
    assert(task.forbiddenCaptureFields.length >= 3, `${task.taskId} metadata-only task must keep forbidden fields`)
  }
  const registrationDraft = sourceRegistrationByTaskId.get(task.taskId)
  assert(registrationDraft, `${task.taskId} missing source registration draft`)
  assert(registrationDraft.registrationId === `${task.taskId}.source-registration`, `${task.taskId} invalid registration id`)
  assert(registrationDraft.sourceSeedId === task.sourceSeedId, `${task.taskId} registration seed mismatch`)
  assert(registrationDraft.sourceKind === task.sourceKind, `${task.taskId} registration sourceKind mismatch`)
  assert(registrationDraft.storagePolicy === seed.storagePolicy, `${task.taskId} registration storagePolicy mismatch`)
  assert(registrationDraft.status === "queued", `${task.taskId} registration draft must start queued`)
  assert(registrationDraft.forbiddenCaptureFields.length === task.forbiddenCaptureFields.length, `${task.taskId} registration forbidden fields mismatch`)

  const captureInput = captureInputByTaskId.get(task.taskId)
  assert(captureInput, `${task.taskId} missing fragment capture input`)
  assert(captureInput.captureInputId === `${task.taskId}.fragment-capture`, `${task.taskId} invalid capture input id`)
  assert(captureInput.sourceRegistrationId === registrationDraft.registrationId, `${task.taskId} capture registration mismatch`)
  assert(captureInput.captureStage === "fragment-capture", `${task.taskId} capture stage mismatch`)
  assert(captureInput.storagePolicy === seed.storagePolicy, `${task.taskId} capture storagePolicy mismatch`)
  assert(captureInput.topicTags.length === seed.topicTags.length, `${task.taskId} capture topicTags mismatch`)
  assert(captureInput.expectedEntityKinds.length === seed.expectedEntityKinds.length, `${task.taskId} capture expected entities mismatch`)
  assert(captureInput.forbiddenCaptureFields.length === task.forbiddenCaptureFields.length, `${task.taskId} capture forbidden fields mismatch`)

  const cleaningInput = cleaningInputByTaskId.get(task.taskId)
  assert(cleaningInput, `${task.taskId} missing cleaning input draft`)
  assert(cleaningInput.cleaningInputId === `${task.taskId}.cleaning-input`, `${task.taskId} invalid cleaning input id`)
  assert(cleaningInput.sourceRegistrationId === registrationDraft.registrationId, `${task.taskId} cleaning registration mismatch`)
  assert(cleaningInput.captureInputId === captureInput.captureInputId, `${task.taskId} cleaning capture mismatch`)
  assert(cleaningInput.pipelineId === seed.handoffPipelineId, `${task.taskId} cleaning pipeline mismatch`)
  assert(cleaningInput.sourceKind === task.sourceKind, `${task.taskId} cleaning sourceKind mismatch`)
  assert(cleaningInput.dedupHintFields.length >= 4, `${task.taskId} cleaning dedup hints too short`)
  assert(cleaningInput.conflictCheckIds.length === conflictSignalProfiles.length, `${task.taskId} cleaning conflict checks mismatch`)
  assert(cleaningInput.expectedOutputs.length === task.expectedOutputs.length, `${task.taskId} cleaning expected outputs mismatch`)

  const adapter = adapterBySourceKind.get(task.sourceKind)
  assert(adapter, `${task.taskId} missing adapter for sourceKind`)
  const collectionJob = collectionJobByTaskId.get(task.taskId)
  assert(collectionJob, `${task.taskId} missing collection job draft`)
  assert(collectionJob.jobId === `${task.taskId}.collection-job`, `${task.taskId} invalid collection job id`)
  assert(collectionJob.adapterId === adapter.adapterId, `${task.taskId} collection job adapter mismatch`)
  assert(collectionJob.adapterKind === adapter.adapterKind, `${task.taskId} collection job adapter kind mismatch`)
  assert(collectionJob.sourceRegistrationId === registrationDraft.registrationId, `${task.taskId} collection job registration mismatch`)
  assert(collectionJob.captureInputId === captureInput.captureInputId, `${task.taskId} collection job capture mismatch`)
  assert(collectionJob.cleaningInputId === cleaningInput.cleaningInputId, `${task.taskId} collection job cleaning mismatch`)
  assert(collectionJob.sourceKind === task.sourceKind, `${task.taskId} collection job sourceKind mismatch`)
  assert(collectionJob.storagePolicy === seed.storagePolicy, `${task.taskId} collection job storagePolicy mismatch`)
  assert(collectionJob.requestMode === adapter.requestMode, `${task.taskId} collection job requestMode mismatch`)
  assert(collectionJob.locatorTemplate === seed.locatorTemplate, `${task.taskId} collection job locator mismatch`)
  assert(collectionJob.allowedCaptureFields.length === captureInput.allowedCaptureFields.length, `${task.taskId} collection job allowed fields mismatch`)
  assert(collectionJob.forbiddenCaptureFields.length === captureInput.forbiddenCaptureFields.length, `${task.taskId} collection job forbidden fields mismatch`)
  assert(collectionJob.expectedOutputs.length === task.expectedOutputs.length, `${task.taskId} collection job expected outputs mismatch`)
  assert(collectionJob.guardrails.length >= adapter.guardrails.length, `${task.taskId} collection job guardrails too short`)
  if (task.status === "ready") {
    assert(collectionJob.status === "ready", `${task.taskId} ready task must produce ready collection job`)
  }
  if (task.status === "queued") {
    assert(collectionJob.status === "draft", `${task.taskId} queued task must produce draft collection job`)
  }
  if (collectionJob.requestMode === "metadata-only") {
    assert(
      collectionJob.forbiddenCaptureFields.some((field) =>
        field.includes("姝ｆ枃") ||
        field.includes("正文") ||
        field.includes("截图") ||
        field.includes("鎴浘") ||
        field.includes("扫描") ||
        field.includes("影像") ||
        field.includes("版式")
      ),
      `${task.taskId} metadata-only job must keep forbidden text, image or layout fields`
    )
  }
  if (collectionJob.requestMode === "own-summary-only") {
    assert(
      collectionJob.allowedCaptureFields.some((field) => field.includes("摘要") || field.includes("鎽樿")),
      `${task.taskId} own-summary job must expose summary field only`
    )
  }

  if (task.reviewQueueId) {
    const reviewItem = reviewItemByTaskId.get(task.taskId)
    assert(reviewItem, `${task.taskId} missing review queue item draft`)
    assert(reviewItem.reviewItemId === `${task.taskId}.review-item`, `${task.taskId} invalid review item id`)
    assert(reviewItem.reviewQueueId === task.reviewQueueId, `${task.taskId} review queue mismatch`)
    assert(reviewItem.sourceKind === task.sourceKind, `${task.taskId} review sourceKind mismatch`)
    assert(reviewItem.requiredReviewFields.length === task.requiredFieldIds.length, `${task.taskId} review fields mismatch`)
    assert(reviewItem.promotionCriteria.length === batch.reviewGates.length, `${task.taskId} review gates mismatch`)
    assert(reviewItem.blockingSignals.length === task.forbiddenCaptureFields.length, `${task.taskId} review blocking signals mismatch`)
    assert(collectionJob.reviewQueueId === task.reviewQueueId, `${task.taskId} collection job review queue mismatch`)
  }
}
assert(
  collectionReviewQueueItemDrafts.length === collectionExecutionTaskRecords.filter((task) => Boolean(task.reviewQueueId)).length,
  "review queue item drafts must match tasks with reviewQueueId"
)

assert(collectionRunBatches.length === 1, `expected 1 collection run batch, got ${collectionRunBatches.length}`)
const collectionRunBatch = collectionRunBatches[0]
const collectionJobIds = new Set(collectionJobDrafts.map((job) => job.jobId))
const collectionRunResultByJobId = new Map(collectionRunResultDrafts.map((result) => [result.jobId, result]))
const collectionBlockRecordByJobId = new Map(collectionJobBlockRecords.map((record) => [record.jobId, record]))
const collectionAuditBySubjectId = new Map(collectionAuditRecords.map((record) => [record.subjectId, record]))
const readyJobIds = collectionJobDrafts.filter((job) => job.status === "ready").map((job) => job.jobId)
const draftJobIds = collectionJobDrafts.filter((job) => job.status === "draft").map((job) => job.jobId)
const blockedJobIds = collectionJobDrafts.filter((job) => job.status === "blocked").map((job) => job.jobId)
assert(collectionRunBatch.runBatchId === "p35.collection-run.ziwei-v1", "missing ziwei collection run batch")
assert(collectionRunBatch.domain === "ziwei", "collection run batch must be ziwei domain")
assert(collectionRunBatch.jobIds.length === collectionJobDrafts.length, "run batch jobIds mismatch")
assert(collectionRunBatch.readyJobIds.length === readyJobIds.length, "run batch ready job count mismatch")
assert(collectionRunBatch.draftJobIds.length === draftJobIds.length, "run batch draft job count mismatch")
assert(collectionRunBatch.blockedJobIds.length === blockedJobIds.length, "run batch blocked job count mismatch")
assert(collectionRunBatch.status === "partial-ready", "run batch must be partial-ready while planned batches remain draft")
assert(collectionRunBatch.guardrails.length >= 4, "run batch guardrails too short")
assert(collectionRunBatch.auditTrail.some((item) => item === "runner:no-network-side-effect"), "run batch must declare no network side effect")
for (const jobId of collectionRunBatch.jobIds) {
  assert(collectionJobIds.has(jobId), `run batch references unknown job: ${jobId}`)
}
assert(collectionRunResultDrafts.length === collectionJobDrafts.length, "each collection job must produce one run result draft")
assert(collectionJobBlockRecords.length === collectionJobDrafts.length, "each collection job must produce one block record")
assert(collectionAuditRecords.length === collectionJobDrafts.length + 1, "audit records must cover run batch plus each job")
assert(collectionAuditBySubjectId.has(collectionRunBatch.runBatchId), "missing run batch audit record")
for (const job of collectionJobDrafts) {
  const runResult = collectionRunResultByJobId.get(job.jobId)
  assert(runResult, `${job.jobId} missing run result draft`)
  assert(runResult.runResultId === `${job.jobId}.run-result`, `${job.jobId} invalid run result id`)
  assert(runResult.runBatchId === collectionRunBatch.runBatchId, `${job.jobId} run result batch mismatch`)
  assert(runResult.adapterId === job.adapterId, `${job.jobId} run result adapter mismatch`)
  assert(runResult.requestMode === job.requestMode, `${job.jobId} run result requestMode mismatch`)
  assert(runResult.expectedOutputs.length === job.expectedOutputs.length, `${job.jobId} run result expected outputs mismatch`)
  assert(runResult.producedDraftRefs.includes(job.sourceRegistrationId), `${job.jobId} run result missing source registration ref`)
  assert(runResult.producedDraftRefs.includes(job.captureInputId), `${job.jobId} run result missing capture input ref`)
  assert(runResult.producedDraftRefs.includes(job.cleaningInputId), `${job.jobId} run result missing cleaning input ref`)
  if (job.status === "ready") {
    assert(runResult.status === "ready-to-run", `${job.jobId} ready job must be ready-to-run`)
    assert(runResult.nextAction === "execute-adapter", `${job.jobId} ready job nextAction mismatch`)
  }
  if (job.status === "draft") {
    assert(runResult.status === "waiting", `${job.jobId} draft job must wait`)
    assert(runResult.nextAction === "wait-for-batch-ready", `${job.jobId} draft job nextAction mismatch`)
  }
  if (job.status === "blocked") {
    assert(runResult.status === "blocked", `${job.jobId} blocked job result mismatch`)
  }

  const blockRecord = collectionBlockRecordByJobId.get(job.jobId)
  assert(blockRecord, `${job.jobId} missing block record`)
  assert(blockRecord.blockRecordId === `${job.jobId}.block-record`, `${job.jobId} invalid block record id`)
  assert(blockRecord.runBatchId === collectionRunBatch.runBatchId, `${job.jobId} block record batch mismatch`)
  assert(blockRecord.sourceKind === job.sourceKind, `${job.jobId} block record sourceKind mismatch`)
  assert(blockRecord.requestMode === job.requestMode, `${job.jobId} block record requestMode mismatch`)
  assert(blockRecord.forbiddenCaptureFields.length === job.forbiddenCaptureFields.length, `${job.jobId} block forbidden fields mismatch`)
  assert(blockRecord.blockedOperations.length >= 3, `${job.jobId} block operations too short`)
  assert(blockRecord.status === (job.blockReasons.length > 0 ? "blocked" : "clear"), `${job.jobId} block status mismatch`)
  assert(blockRecord.resolutionPath.length >= 1, `${job.jobId} block resolution path missing`)

  const jobAudit = collectionAuditBySubjectId.get(job.jobId)
  assert(jobAudit, `${job.jobId} missing audit record`)
  assert(jobAudit.runBatchId === collectionRunBatch.runBatchId, `${job.jobId} audit batch mismatch`)
  assert(jobAudit.subjectKind === "collection-job", `${job.jobId} audit subject kind mismatch`)
  assert(jobAudit.passedChecks.length >= 5, `${job.jobId} audit passed checks too short`)
  assert(jobAudit.outputRefs.includes(job.sourceRegistrationId), `${job.jobId} audit missing source registration ref`)
  assert(jobAudit.outputRefs.includes(job.captureInputId), `${job.jobId} audit missing capture input ref`)
  assert(jobAudit.outputRefs.includes(job.cleaningInputId), `${job.jobId} audit missing cleaning input ref`)
}
assert(collectionSourceResultCandidates.length === collectionJobDrafts.length, "each collection job must produce one source result candidate")
assert(collectionFragmentResultCandidates.length === collectionJobDrafts.length, "each collection job must produce one fragment result candidate")
assert(collectionCleanedResultCandidates.length === collectionJobDrafts.length, "each collection job must produce one cleaned result candidate")
assert(collectionTopicMappingCandidates.length === collectionJobDrafts.length, "each collection job must produce one topic mapping candidate")
assert(collectionAdmissionDecisionCandidates.length === collectionJobDrafts.length, "each collection job must produce one admission decision candidate")
assert(collectionReviewRouteCandidates.length === collectionJobDrafts.length, "each collection job must produce one review route candidate")

const sourceResultByJobId = new Map(collectionSourceResultCandidates.map((candidate) => [candidate.jobId, candidate]))
const fragmentResultById = new Map(collectionFragmentResultCandidates.map((candidate) => [candidate.fragmentResultId, candidate]))
const cleanedCandidateById = new Map(collectionCleanedResultCandidates.map((candidate) => [candidate.cleanedCandidateId, candidate]))
const topicMappingByCleanedId = new Map(collectionTopicMappingCandidates.map((candidate) => [candidate.cleanedCandidateId, candidate]))
const admissionByCleanedId = new Map(collectionAdmissionDecisionCandidates.map((candidate) => [candidate.cleanedCandidateId, candidate]))
const reviewRouteByAdmissionId = new Map(collectionReviewRouteCandidates.map((candidate) => [candidate.admissionCandidateId, candidate]))
for (const job of collectionJobDrafts) {
  const runResult = collectionRunResultByJobId.get(job.jobId)
  const sourceResult = sourceResultByJobId.get(job.jobId)
  assert(runResult, `${job.jobId} missing run result before landing`)
  assert(sourceResult, `${job.jobId} missing source result candidate`)
  assert(sourceResult.sourceResultId === `${job.jobId}.source-result`, `${job.jobId} invalid source result id`)
  assert(sourceResult.runResultId === runResult.runResultId, `${job.jobId} source result runResult mismatch`)
  assert(sourceResult.sourceRegistrationId === job.sourceRegistrationId, `${job.jobId} source result registration mismatch`)
  assert(sourceResult.sourceKind === job.sourceKind, `${job.jobId} source result sourceKind mismatch`)
  assert(sourceResult.storagePolicy === job.storagePolicy, `${job.jobId} source result storagePolicy mismatch`)

  const expectedLandingStatus = runResult.status === "ready-to-run" || runResult.status === "completed"
    ? "candidate-ready"
    : runResult.status === "blocked"
      ? "blocked"
      : "waiting-for-run"
  assert(sourceResult.status === expectedLandingStatus, `${job.jobId} source result status mismatch`)

  const fragmentResult = fragmentResultById.get(`${job.jobId}.fragment-result`)
  assert(fragmentResult, `${job.jobId} missing fragment result candidate`)
  assert(fragmentResult.sourceResultId === sourceResult.sourceResultId, `${job.jobId} fragment source result mismatch`)
  assert(fragmentResult.captureInputId === job.captureInputId, `${job.jobId} fragment capture input mismatch`)
  assert(fragmentResult.storagePolicy === job.storagePolicy, `${job.jobId} fragment storagePolicy mismatch`)
  assert(fragmentResult.status === sourceResult.status, `${job.jobId} fragment status mismatch`)
  assert(fragmentResult.forbiddenCaptureFields.length === job.forbiddenCaptureFields.length, `${job.jobId} fragment forbidden fields mismatch`)

  const cleanedCandidate = cleanedCandidateById.get(`${job.jobId}.cleaned-candidate`)
  assert(cleanedCandidate, `${job.jobId} missing cleaned result candidate`)
  assert(cleanedCandidate.fragmentResultId === fragmentResult.fragmentResultId, `${job.jobId} cleaned fragment mismatch`)
  assert(cleanedCandidate.cleaningInputId === job.cleaningInputId, `${job.jobId} cleaned cleaning input mismatch`)
  assert(cleanedCandidate.sourceKind === job.sourceKind, `${job.jobId} cleaned sourceKind mismatch`)
  assert(cleanedCandidate.topicTags.length >= 1, `${job.jobId} cleaned topicTags missing`)
  assert(cleanedCandidate.dedupHintFields.length >= 4, `${job.jobId} cleaned dedup hints too short`)
  assert(cleanedCandidate.conflictCheckIds.length === conflictSignalProfiles.length, `${job.jobId} cleaned conflict checks mismatch`)
  assert(cleanedCandidate.status === fragmentResult.status, `${job.jobId} cleaned status mismatch`)

  const topicMappingCandidate = topicMappingByCleanedId.get(cleanedCandidate.cleanedCandidateId)
  assert(topicMappingCandidate, `${job.jobId} missing topic mapping candidate`)
  assert(
    topicMappingCandidate.topicMappingCandidateId === `${cleanedCandidate.cleanedCandidateId}.topic-mapping`,
    `${job.jobId} invalid topic mapping candidate id`
  )
  assert(topicMappingCandidate.targetDictionaryLayers.length >= 1, `${job.jobId} topic mapping target layers missing`)
  assert(topicMappingCandidate.sourceTraceRefs.includes(cleanedCandidate.fragmentResultId), `${job.jobId} topic mapping missing fragment trace`)
  assert(topicMappingCandidate.sourceTraceRefs.includes(cleanedCandidate.cleaningInputId), `${job.jobId} topic mapping missing cleaning trace`)
  assert(topicMappingCandidate.status === cleanedCandidate.status, `${job.jobId} topic mapping status mismatch`)

  const admissionCandidate = admissionByCleanedId.get(cleanedCandidate.cleanedCandidateId)
  assert(admissionCandidate, `${job.jobId} missing admission decision candidate`)
  assert(
    admissionCandidate.admissionCandidateId === `${cleanedCandidate.cleanedCandidateId}.admission`,
    `${job.jobId} invalid admission candidate id`
  )
  assert(admissionCandidate.topicMappingCandidateId === topicMappingCandidate.topicMappingCandidateId, `${job.jobId} admission topic mapping mismatch`)
  assert(admissionCandidate.status === cleanedCandidate.status, `${job.jobId} admission status mismatch`)
  if (job.storagePolicy === "metadata-only") {
    assert(admissionCandidate.admissionStatus === "metadata-only", `${job.jobId} metadata-only job must stay metadata-only`)
    assert(admissionCandidate.targetDictionaryLayer === null, `${job.jobId} metadata-only candidate must not target dictionary body`)
  } else if (job.reviewQueueId) {
    assert(admissionCandidate.admissionStatus === "review-required", `${job.jobId} review job must require review`)
  } else {
    assert(admissionCandidate.admissionStatus === "admitted", `${job.jobId} no-review non-metadata job should be admitted candidate`)
    assert(admissionCandidate.targetDictionaryLayer !== null, `${job.jobId} admitted candidate missing target layer`)
  }
  if (admissionCandidate.requiredReviewQueueId) {
    assert(reviewQueueIds.has(admissionCandidate.requiredReviewQueueId), `${job.jobId} admission references unknown review queue`)
  }

  const reviewRouteCandidate = reviewRouteByAdmissionId.get(admissionCandidate.admissionCandidateId)
  assert(reviewRouteCandidate, `${job.jobId} missing review route candidate`)
  assert(
    reviewRouteCandidate.reviewRouteCandidateId === `${admissionCandidate.admissionCandidateId}.review-route`,
    `${job.jobId} invalid review route candidate id`
  )
  assert(reviewRouteCandidate.status === admissionCandidate.status, `${job.jobId} review route status mismatch`)
  assert(reviewRouteCandidate.reviewQueueId === admissionCandidate.requiredReviewQueueId, `${job.jobId} review route queue mismatch`)
  assert(
    reviewRouteCandidate.reviewRequired === Boolean(admissionCandidate.requiredReviewQueueId || admissionCandidate.admissionStatus === "review-required"),
    `${job.jobId} review required flag mismatch`
  )
}
const expectedPromotionTargetKinds = [
  "source-result",
  "fragment-result",
  "cleaned-result",
  "topic-mapping",
  "admission-decision",
  "review-route"
]
assert(
  collectionPromotionGateProfiles.length === expectedPromotionTargetKinds.length,
  `expected ${expectedPromotionTargetKinds.length} promotion gates, got ${collectionPromotionGateProfiles.length}`
)
const promotionGateByTargetKind = new Map(collectionPromotionGateProfiles.map((gate) => [gate.targetKind, gate]))
for (const targetKind of expectedPromotionTargetKinds) {
  const gate = promotionGateByTargetKind.get(targetKind)
  assert(gate, `missing promotion gate for ${targetKind}`)
  assert(gate.domain === "ziwei", `${targetKind} promotion gate must be ziwei domain`)
  assert(gate.acceptedCandidateStatuses.length >= 1, `${targetKind} promotion gate missing candidate statuses`)
  assert(gate.acceptedAdmissionStatuses.length >= 1, `${targetKind} promotion gate missing admission statuses`)
  assert(gate.requiredEvidenceRefs.length >= 3, `${targetKind} promotion gate evidence refs too short`)
  assert(gate.promotionRules.length >= 3, `${targetKind} promotion gate rules too short`)
  assert(gate.blockingRules.length >= 3, `${targetKind} promotion gate blocking rules too short`)
  assert(gate.outputs.length >= 3, `${targetKind} promotion gate outputs too short`)
}

const promotionCandidateRows = [
  ...collectionSourceResultCandidates.map((candidate) => ({
    candidateId: candidate.sourceResultId,
    targetKind: "source-result",
    status: candidate.status
  })),
  ...collectionFragmentResultCandidates.map((candidate) => ({
    candidateId: candidate.fragmentResultId,
    targetKind: "fragment-result",
    status: candidate.status
  })),
  ...collectionCleanedResultCandidates.map((candidate) => ({
    candidateId: candidate.cleanedCandidateId,
    targetKind: "cleaned-result",
    status: candidate.status
  })),
  ...collectionTopicMappingCandidates.map((candidate) => ({
    candidateId: candidate.topicMappingCandidateId,
    targetKind: "topic-mapping",
    status: candidate.status
  })),
  ...collectionAdmissionDecisionCandidates.map((candidate) => ({
    candidateId: candidate.admissionCandidateId,
    targetKind: "admission-decision",
    status: candidate.status
  })),
  ...collectionReviewRouteCandidates.map((candidate) => ({
    candidateId: candidate.reviewRouteCandidateId,
    targetKind: "review-route",
    status: candidate.status
  }))
]
assert(
  collectionPromotionDecisionRecords.length === promotionCandidateRows.length,
  `expected ${promotionCandidateRows.length} promotion decisions, got ${collectionPromotionDecisionRecords.length}`
)
const promotionDecisionByCandidateId = new Map(collectionPromotionDecisionRecords.map((decision) => [decision.candidateId, decision]))
for (const row of promotionCandidateRows) {
  const decision = promotionDecisionByCandidateId.get(row.candidateId)
  assert(decision, `missing promotion decision for ${row.candidateId}`)
  const gate = promotionGateByTargetKind.get(row.targetKind)
  assert(gate, `${row.candidateId} missing gate for target kind`)
  assert(decision.gateId === gate.gateId, `${row.candidateId} promotion gate mismatch`)
  assert(decision.targetKind === row.targetKind, `${row.candidateId} promotion target mismatch`)
  assert(decision.domain === "ziwei", `${row.candidateId} promotion decision must be ziwei domain`)
  assert(expectedSourceKinds.includes(decision.sourceKind), `${row.candidateId} promotion sourceKind unknown`)
  assert(allowedAdmissionStatuses.has(decision.admissionStatus), `${row.candidateId} promotion admission status unknown`)
  assert(decision.nextAction.length > 0, `${row.candidateId} promotion nextAction missing`)
  assert(decision.auditTrail.some((item) => item.startsWith("promotion-gate:")), `${row.candidateId} missing gate audit`)

  if (row.status === "waiting-for-run") {
    assert(decision.decision === "wait", `${row.candidateId} waiting candidate must wait`)
    assert(decision.promotedRecordRefs.length === 0, `${row.candidateId} waiting candidate must not promote`)
  }
  if (row.status === "blocked") {
    assert(decision.decision === "reject", `${row.candidateId} blocked candidate must reject`)
    assert(decision.blockedReason === "candidate-blocked-or-rejected", `${row.candidateId} blocked reason mismatch`)
  }
  if (decision.admissionStatus === "metadata-only") {
    assert(decision.decision === "metadata-only" || decision.decision === "wait", `${row.candidateId} metadata-only decision mismatch`)
    assert(decision.targetDictionaryLayer === null, `${row.candidateId} metadata-only must not target dictionary body`)
  }
  if (decision.decision === "review-required") {
    assert(decision.reviewQueueId, `${row.candidateId} review decision must keep reviewQueueId`)
    assert(reviewQueueIds.has(decision.reviewQueueId), `${row.candidateId} review decision references unknown queue`)
    assert(decision.promotedRecordRefs.length === 0, `${row.candidateId} review decision must not promote yet`)
  }
  if (decision.decision === "promote") {
    assert(decision.targetDictionaryLayer !== null, `${row.candidateId} promote decision missing target dictionary layer`)
    assert(decision.promotedRecordRefs.includes(row.candidateId), `${row.candidateId} promote decision missing promoted ref`)
  }
}

console.log(
  [
    "[check-p35-data-intake] passed",
    `plans=${plans.length}`,
    `closures=${closureReports.length}`,
    `analysisUsage=${analysisUsageProfiles.length}`,
    `collectionFields=${collectionFieldProfiles.length}`,
    `sourceSeeds=${sourceSeedRecords.length}`,
    `collectionBatches=${collectionBatchPlans.length}`,
    `collectionAdapters=${collectionAdapterProfiles.length}`,
    `collectionTasks=${collectionExecutionTaskRecords.length}`,
    `collectionRegistrations=${collectionSourceRegistrationDrafts.length}`,
    `collectionCaptures=${collectionFragmentCaptureInputs.length}`,
    `collectionCleaningInputs=${collectionCleaningInputDrafts.length}`,
    `collectionReviewItems=${collectionReviewQueueItemDrafts.length}`,
    `collectionJobs=${collectionJobDrafts.length}`,
    `collectionRuns=${collectionRunBatches.length}`,
    `collectionRunResults=${collectionRunResultDrafts.length}`,
    `collectionBlocks=${collectionJobBlockRecords.length}`,
    `collectionAudits=${collectionAuditRecords.length}`,
    `collectionSourceCandidates=${collectionSourceResultCandidates.length}`,
    `collectionFragmentCandidates=${collectionFragmentResultCandidates.length}`,
    `collectionCleanedCandidates=${collectionCleanedResultCandidates.length}`,
    `collectionTopicCandidates=${collectionTopicMappingCandidates.length}`,
    `collectionAdmissionCandidates=${collectionAdmissionDecisionCandidates.length}`,
    `collectionReviewRouteCandidates=${collectionReviewRouteCandidates.length}`,
    `collectionPromotionGates=${collectionPromotionGateProfiles.length}`,
    `collectionPromotionDecisions=${collectionPromotionDecisionRecords.length}`,
    `sources=${sources.length}`,
    `fragments=${fragments.length}`,
    `mappings=${mappings.length}`,
    `dictionaryMappings=${dictionaryMappingProfiles.length}`,
    `admissionPolicies=${admissionPolicyProfiles.length}`,
    `admissionDecisions=${admissionDecisionRecords.length}`,
    `boundaryProfiles=${boundaryProfiles.length}`,
    `dedupProfiles=${dedupProfiles.length}`,
    `entityProfiles=${entityExtractionProfiles.length}`,
    `cleanedResults=${cleanedResultRecords.length}`,
    `pipelines=${cleaningPipelineProfiles.length}`,
    `scenarios=${cleaningPipelineScenarios.length}`,
    `conflictSignals=${conflictSignalProfiles.length}`,
    `reviewQueues=${ziweiReviewQueueProfiles.length + commonReviewQueueProfiles.length}`,
    `directoryRules=${directoryRules.length}`,
    `scoreRules=${scoreRules.length}`
  ].join(" ")
)
