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

const config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json");
assert(config.conditionChannels === 23, "V7 config does not define 23 channels");
assert(config.conditionChannelOrder?.length === 23, "V7 channel order is incomplete");
assert(new Set(config.conditionChannelOrder).size === 23, "V7 channel order contains duplicates");
const typed = [...config.conditionChannelTypes.discrete, ...config.conditionChannelTypes.continuous];
assert(typed.length === 23 && new Set(typed).size === 23, "V7 channel types do not uniquely cover all channels");
assert(config.conditionResizeContract === "discrete_nearest_continuous_bilinear_v1", "V7 resize contract mismatch");

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
  conditionChannelsVerified: 23,
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
