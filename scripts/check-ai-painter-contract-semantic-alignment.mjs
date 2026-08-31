import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const historicalContracts = {
  "data/ai-painter/system-governance/ai-painter-autonomous-package-decision-contract-v1.json": "38594b9ed27c7f70bacebda203eefe956d6ed48d6c4624a5884b9d7ab8e354a6",
  "data/ai-painter/system-governance/complete-map-world-training-and-dynamic-readiness-contract-v2.json": "013f5a2f930bcc43d85f29d8166db4a06deaf337fa38fd5b87f5f3d46f11d0e4",
  "data/ai-painter/system-governance/local-ai-responsibility-contract-v1.json": "27b69bb4ffc51a31315b0b3711a23aa3d8a70a41b8f871ea5ac843458ff58010",
  "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json": "dbaa11307d485ee4bf2e84f9fb1eaf126edd9399a148055b4107b87cce4b9118",
  "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v2.json": "dbda4e6744352b8cc8afdf9367772684151d12266be607261af6321002d1221f",
  "data/ai-painter/system-governance/ai-painter-capability-release-registry-v1.json": "4d632ec8de7cc0286e2144b1f3a8965c21b2fc18618bc8f673dfef186fbe992e",
};
const currentContracts = {
  business: "data/ai-painter/system-governance/complete-map-world-business-contract-v3.json",
  condition: "data/ai-painter/system-governance/ai-painter-complete-map-condition-contract-v1.json",
  responsibility: "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v3.json",
  autonomy: "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v3.json",
  releaseRegistry: "data/ai-painter/system-governance/ai-painter-capability-release-registry-v2.json",
};

for (const [file, expectedSha256] of Object.entries(historicalContracts)) {
  assert(exists(file), `historical contract missing: ${file}`);
  assert(sha256(readBytes(file)) === expectedSha256, `historical contract bytes changed: ${file}`);
}
for (const file of Object.values(currentContracts)) assert(exists(file), `current contract missing: ${file}`);

const supersession = readJson("data/ai-painter/system-governance/contract-supersession-index-v2.json");
assert(supersession.policy?.historicalContractBytesMustRemainImmutable === true, "historical contract immutability policy missing");
assert(supersession.policy?.historicalContractsMayNotAuthorizeNewWork === true, "historical contracts are not execution-blocked");
assert(supersession.policy?.ownerWaitContractsMayNotBeActivated === true, "Owner wait contracts are not activation-blocked");
for (const [historicalPath, historicalSha256] of Object.entries(historicalContracts)) {
  const records = supersession.supersessions?.filter((entry) => entry.historicalPath === historicalPath) ?? [];
  assert(records.length === 1, `historical contract must have one supersession record: ${historicalPath}`);
  assert(records[0].historicalSha256 === historicalSha256, `historical supersession SHA mismatch: ${historicalPath}`);
  assert(records[0].executionStatus === "historical_read_only_not_valid_for_new_work", `historical contract is executable: ${historicalPath}`);
  assert(sha256(readBytes(records[0].successorPath)) === records[0].successorSha256, `successor SHA mismatch: ${records[0].successorPath}`);
}

const business = readJson(currentContracts.business);
assert(business.status === "active_long_term_business_contract", "business contract is not active");
assert(business.ownerAuthorizationId === undefined, "long-term business contract contains cold-start Owner authorization");
assert(business.executionGate === undefined, "long-term business contract contains task execution gates");

const expectedConditionOrder = [
  "terrain_grass",
  "terrain_water",
  "terrain_path_ground",
  "terrain_shoreline",
  "terrain_natural_boundary",
  "terrain_mud_patch",
  "terrain_tall_grass",
  "walkable",
  "collision",
  "object_footprints",
  "object_tree",
  "object_rock",
  "object_vegetation",
  "focal_area",
  "object_instance",
  "coordinate_x",
  "coordinate_y",
  "signed_distance_path",
  "signed_distance_water",
  "signed_distance_shoreline",
  "signed_distance_object_ground",
  "signed_distance_boundary",
  "moisture_proximity",
];
const expectedDiscreteConditions = expectedConditionOrder.slice(0, 15);
const expectedContinuousConditions = expectedConditionOrder.slice(15);
const condition = readJson(currentContracts.condition);
assert(condition.schemaVersion === "ai-painter-complete-map-condition-contract-v1", "current condition contract schema mismatch");
assert(condition.contractId === "ai-painter-complete-map-condition-contract-v1", "current condition contract identity mismatch");
assert(condition.conditionContractIdentity === "ai-painter-complete-map-23-channel-condition-v1", "current condition tensor identity mismatch");
assert(condition.status === "active_current_machine_condition_contract", "current condition contract is not active");
assert(condition.authority === "local_ai_pet_world_program", "current condition contract authority mismatch");
assert(condition.scope?.nativeWidth === 1024 && condition.scope?.nativeHeight === 768, "current condition native frame mismatch");
assert(condition.scope?.frameScope === "complete_runtime_frame", "current condition frame scope mismatch");
assert(condition.scope?.playerFacingPixelsGenerated === false, "condition compilation may generate player-facing pixels");
assert(condition.tensorContract?.channelCount === 23, "current condition contract does not define 23 channels");
assert(JSON.stringify(condition.tensorContract?.channelOrder) === JSON.stringify(expectedConditionOrder), "current condition channel order mismatch");
assert(JSON.stringify(condition.tensorContract?.typePartitions?.discrete) === JSON.stringify(expectedDiscreteConditions), "current condition discrete partition mismatch");
assert(JSON.stringify(condition.tensorContract?.typePartitions?.continuous) === JSON.stringify(expectedContinuousConditions), "current condition continuous partition mismatch");
assert(condition.tensorContract?.storage?.dtype === "uint8", "current condition storage dtype mismatch");
assert(JSON.stringify(condition.tensorContract?.storage?.valueRangeInclusive) === JSON.stringify([0, 255]), "current condition storage range mismatch");
assert(JSON.stringify(condition.tensorContract?.storage?.nativeShape) === JSON.stringify([1, 768, 1024]), "current condition native shape mismatch");
assert(condition.tensorContract?.modelInput?.dtype === "float32", "current condition model dtype mismatch");
assert(condition.tensorContract?.modelInput?.normalizationFormula === "float32(storage_uint8) / 255.0", "current condition normalization formula mismatch");
assert(JSON.stringify(condition.tensorContract?.modelInput?.normalizedRangeInclusive) === JSON.stringify([0, 1]), "current condition normalized range mismatch");
assert(condition.tensorContract?.modelInput?.missingChannelFillAllowed === false, "current condition contract permits missing-channel fill");
assert(condition.tensorContract?.modelInput?.channelReorderAllowed === false, "current condition contract permits channel reorder");
assert(condition.tensorContract?.resize?.contractId === "discrete_nearest_continuous_bilinear_v1", "current condition resize identity mismatch");
assert(condition.tensorContract?.resize?.typePartitionMustOccurBeforeResize === true, "current condition contract does not type-partition before resize");
assert(condition.tensorContract?.resize?.featureMixingBeforeTypedResizeAllowed === false, "current condition contract permits mixing before typed resize");
assert(condition.tensorContract?.resize?.discrete?.mode === "nearest", "current condition discrete resize mismatch");
assert(condition.tensorContract?.resize?.discrete?.intermediateValuesMayBeIntroduced === false, "current condition discrete resize permits interpolation values");
assert(condition.tensorContract?.resize?.continuous?.mode === "bilinear", "current condition continuous resize mismatch");
assert(condition.tensorContract?.resize?.continuous?.alignCorners === false, "current condition continuous alignCorners mismatch");
assert(condition.channelDefinitions?.length === 23, "current condition definitions are incomplete");
for (let index = 0; index < expectedConditionOrder.length; index += 1) {
  const definition = condition.channelDefinitions[index];
  assert(definition?.index === index, `condition definition index mismatch: ${index}`);
  assert(definition?.id === expectedConditionOrder[index], `condition definition identity mismatch: ${index}`);
  assert(definition?.type === (index < 15 ? "discrete" : "continuous"), `condition definition type mismatch: ${definition?.id}`);
  assert(typeof definition?.encoding === "string" && definition.encoding.length > 0, `condition definition encoding missing: ${definition?.id}`);
  assert(typeof definition?.semantic === "string" && definition.semantic.length > 0, `condition definition semantic missing: ${definition?.id}`);
}
for (const field of [
  "conditionContractIdentity",
  "conditionContractPath",
  "conditionContractSha256",
  "conditionPackageId",
  "conditionPackagePath",
  "conditionPackageSha256",
  "taskPackageId",
  "taskPackagePath",
  "taskPackageSha256",
  "taskManifestPath",
  "taskManifestSha256",
  "worldId",
  "regionId",
  "tick",
  "factHash",
  "visualFactManifestId",
  "visualFactManifestPath",
  "visualFactManifestSha256",
  "dictionaryVersionId",
  "datasetReleaseIdentity",
]) assert(condition.identityBindings?.requiredFields?.includes(field), `current condition identity binding missing: ${field}`);
assert(condition.identityBindings?.bindingContainer === "identityBindings", "current condition binding container mismatch");
assert(condition.identityBindings?.conditionPackageSha256Canonicalization?.excludedFields?.includes("conditionPackSha256"), "condition package canonicalization does not exclude the top-level self hash");
assert(condition.identityBindings?.conditionPackageSha256Canonicalization?.excludedFields?.includes("identityBindings.conditionPackageSha256"), "condition package canonicalization does not exclude the nested self hash");
assert(condition.identityBindings?.crossRunOrCrossSampleSubstitutionAllowed === false, "current condition contract permits cross-run or cross-sample substitution");
assert(condition.identityBindings?.pathWithoutSha256Allowed === false, "current condition contract permits unverified paths");
assert(condition.identityBindings?.sha256WithoutReadablePathAllowed === false, "current condition contract permits detached hashes");
assert(condition.authoritativeInputInvariance?.worldFactsMustPreexistConditionCompilation === true, "WorldFacts preexistence is not required");
assert(condition.authoritativeInputInvariance?.visualFactManifestMustPreexistConditionCompilation === true, "VisualFactManifest preexistence is not required");
assert(condition.authoritativeInputInvariance?.conditionCompilerMayModifyWorldFacts === false, "condition compiler may modify WorldFacts");
assert(condition.authoritativeInputInvariance?.conditionCompilerMayModifyVisualFactManifest === false, "condition compiler may modify VisualFactManifest");
assert(condition.authoritativeInputInvariance?.conditionCompilerMayInferMissingWorldFacts === false, "condition compiler may infer missing WorldFacts");
assert(condition.authoritativeInputInvariance?.rgbMayReplaceWorldFacts === false, "RGB may replace WorldFacts");
assert(condition.authoritativeInputInvariance?.rgbMayReplaceVisualFactManifest === false, "RGB may replace VisualFactManifest");
assert(condition.missingChannelPolicy?.all23ChannelsRequiredForTrainingAndInference === true, "current condition contract does not require all 23 channels");
assert(condition.missingChannelPolicy?.silentZeroFillAllowed === false, "current condition contract permits silent zero fill");
assert(condition.missingChannelPolicy?.modelGuessAllowed === false, "current condition contract permits guessed channels");
assert(condition.currentPackageRegistry?.schemaVersion === "ai-painter-current-condition-package-registry-v1", "current condition package registry schema missing");
assert(condition.currentPackageRegistry?.path === ".runtime/ai-painter/current-condition-package-registry/current.json", "current condition package registry path mismatch");
assert(condition.currentPackageRegistry?.legacyLatestPointerFallbackAllowed === false, "current condition contract permits legacy latest fallback");
assert(condition.currentPackageRegistry?.missingRegistryStatus === "no_current_condition_package_registered", "missing current condition package status mismatch");
for (const forbiddenField of condition.forbiddenFieldNames ?? []) {
  assert(!objectHasKey(condition, forbiddenField), `current condition contract contains forbidden historical field: ${forbiddenField}`);
}
const currentConditionCheckerText = readText("scripts/check-current-world-visual-conditions.mjs");
const currentConditionCompilerText = readText("scripts/compile-current-world-visual-conditions.mjs");
const typedResizeCheckerText = readText("ml/ai-painter/scripts/check_typed_condition_resize_behavior.py");
assert(!currentConditionCheckerText.includes("world-visual-generation-task-packages/latest.json"), "current condition checker still reads the historical latest pointer");
assert(currentConditionCheckerText.includes("currentPackageRegistry"), "current condition checker does not select through the formal current registry");
assert(currentConditionCheckerText.includes("no_current_condition_package_registered"), "current condition checker does not expose the missing-current-package status");
assert(!currentConditionCompilerText.includes("world-visual-generation-task-packages/latest.json"), "condition compiler still falls back to the historical latest pointer");
assert(currentConditionCompilerText.includes("legacy latest task fallback is forbidden"), "condition compiler does not fail closed without an explicit task manifest");
assert(currentConditionCompilerText.includes("ai-painter-complete-map-condition-contract-v1.json"), "condition compiler does not bind the current condition contract");
assert(!currentConditionCheckerText.includes("cold-start-v7") && !typedResizeCheckerText.includes("cold-start-v7"), "historical cold-start V7 configuration is still used by current condition validation");

const responsibility = readJson(currentContracts.responsibility);
assert(responsibility.normalAutonomousPath?.ownerInStateMachine === false, "Owner remains in normal state machine");
assert(responsibility.normalAutonomousPath?.perTaskOwnerAuthorizationRequired === false, "normal runtime still requires task authorization");
assert(responsibility.normalAutonomousPath?.perStageOwnerAuthorizationRequired === false, "normal runtime still requires stage authorization");
assert(responsibility.normalAutonomousPath?.perCapabilityVersionOwnerAuthorizationRequired === false, "normal runtime still requires capability-version authorization");
assert(responsibility.policyBoundaryPath?.waitForOwnerResponse === false, "policy boundary still waits for Owner");
assert(responsibility.policyBoundaryPath?.ownerActionRequestGenerated === false, "policy boundary still creates Owner requests");
assert(responsibility.ownerBoundary?.programMayWaitForOwnerAuthorization === false, "program may still wait for Owner authorization");

const autonomy = readJson(currentContracts.autonomy);
assert(autonomy.status === "policy_active_no_capability_release", "runtime policy incorrectly implies a released capability");
assert(autonomy.authorityBoundary?.normalOperationAuthority === "local_ai_pet_world_program", "local AI is not normal-operation authority");
assert(autonomy.authorityBoundary?.ownerInNormalStateMachine === false, "Owner remains in runtime state machine");
assert(autonomy.decisionRules?.ambiguousTargetState === "blocked_policy_boundary", "ambiguous evidence does not fail closed at policy boundary");
assert(autonomy.decisionRules?.ownerResponseWaitAllowed === false, "runtime policy permits Owner response waits");
assert(autonomy.capabilityReleaseVerification?.machineSignatureRequiredForInternalTicket === true, "ticket machine signature is not required");
assert(autonomy.capabilityReleaseVerification?.persistentReplayLedgerRequired === true, "persistent replay protection is not required");
for (const forbidden of ["waiting_owner_decision", "waiting_capability_change", "owner.wait"]) {
  assert(!autonomy.executionStates?.includes(forbidden), `forbidden execution state remains: ${forbidden}`);
  assert(!autonomy.releasedCapabilityInternalActions?.includes(forbidden), `forbidden internal action remains: ${forbidden}`);
}

const releaseRegistry = readJson(currentContracts.releaseRegistry);
assert(releaseRegistry.status === "active_no_capability_release", "current registry incorrectly claims a released capability");
assert(releaseRegistry.registryRevision === 0, "empty release registry revision must be zero");
assert(Array.isArray(releaseRegistry.releaseRecords) && releaseRegistry.releaseRecords.length === 0, "current registry must not contain a released capability");
assert(releaseRegistry.uniqueWriter?.identity === "local_ai_capability_release_orchestrator", "release registry unique writer mismatch");
assert(releaseRegistry.trustBoundary?.ownerDecisionAcceptedAsReleaseAuthority === false, "Owner decision remains a release authority");

const autonomySource = readText("scripts/lib/ai-painter-autonomous-package-decision-core-v3.mjs");
for (const required of [
  "verified_from_machine_adjudication_and_trusted_registry",
  "machine release adjudication",
  "ticket machine signature mismatch",
  "runtime_capability_ticket_consumptions",
  "blocked_policy_boundary",
  "ownerResponseRequired: false",
]) assert(autonomySource.includes(required), `runtime autonomy implementation missing: ${required}`);
for (const forbidden of ["Owner release decision", 'status: "waiting_owner_decision"', '"owner.wait":']) {
  assert(!autonomySource.includes(forbidden), `runtime autonomy implementation retains executable Owner wait logic: ${forbidden}`);
}

const governanceSource = readText("scripts/lib/ai-painter-local-autonomy-governance-v3.mjs");
for (const required of [
  "policy_boundary_reports",
  "ownerAuthorizationRequested: false",
  "ownerResponseRequired: false",
  "BEGIN IMMEDIATE",
]) assert(governanceSource.includes(required), `local autonomy governance implementation missing: ${required}`);
assert(!governanceSource.includes("normalizeOwnerActionRequest"), "current governance still normalizes Owner action requests");

const packageJson = readJson("package.json");
assert(packageJson.scripts?.["record:ai-painter-owner-action-request"] === undefined, "Owner action request remains a current package entry");
assert(packageJson.scripts?.["legacy:record:ai-painter-owner-action-request"], "historical Owner request recorder is not explicitly namespaced as legacy");
assert(packageJson.scripts?.["record:ai-painter-policy-boundary-report"], "policy boundary report entry is missing");
assert(packageJson.scripts?.["check:ai-painter-local-autonomy-governance"], "local autonomy governance check entry is missing");

console.log(JSON.stringify({
  ok: true,
  status: "ai_painter_machine_contract_cpu_core_alignment_passed",
  historicalContractsRetainedImmutable: Object.keys(historicalContracts),
  historicalContractsBlockedForNewWork: true,
  currentContracts: Object.values(currentContracts),
  ownerInNormalStateMachine: false,
  ownerActionRequestCurrentEntryRemoved: true,
  machineReleaseAdjudicationRequired: true,
  persistentTicketReplayProtectionRequired: true,
  currentCapabilityReleaseStatus: "none_released",
  conditionContractIdentity: condition.conditionContractIdentity,
  conditionContractPath: currentContracts.condition,
  conditionContractSha256: sha256(readBytes(currentContracts.condition)),
  conditionChannelsVerified: 23,
  discreteConditionChannelsVerified: 15,
  continuousConditionChannelsVerified: 8,
  historicalColdStartConditionConfigUsedAsAuthority: false,
  genericAutonomousOrchestratorIntegrated: true,
  candidateSpecificFullTrainingAdapterStatus: "not_materialized",
  fullTrainingRunnerAdoptionClaimed: false,
}, null, 2));

function readJson(relativePath) { return JSON.parse(readText(relativePath)); }
function readText(relativePath) { return fs.readFileSync(path.resolve(ROOT, relativePath), "utf8"); }
function readBytes(relativePath) { return fs.readFileSync(path.resolve(ROOT, relativePath)); }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function exists(relativePath) { return fs.existsSync(path.resolve(ROOT, relativePath)); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function objectHasKey(value, targetKey) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => objectHasKey(item, targetKey));
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) return true;
  return Object.values(value).some((item) => objectHasKey(item, targetKey));
}
