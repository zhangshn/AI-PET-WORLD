import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const historicalContracts = {
  "data/ai-painter/system-governance/ai-painter-autonomous-package-decision-contract-v1.json": "38594b9ed27c7f70bacebda203eefe956d6ed48d6c4624a5884b9d7ab8e354a6",
  "data/ai-painter/system-governance/complete-map-world-training-and-dynamic-readiness-contract-v2.json": "013f5a2f930bcc43d85f29d8166db4a06deaf337fa38fd5b87f5f3d46f11d0e4",
  "data/ai-painter/system-governance/local-ai-responsibility-contract-v1.json": "27b69bb4ffc51a31315b0b3711a23aa3d8a70a41b8f871ea5ac843458ff58010",
}
const currentContracts = {
  business: "data/ai-painter/system-governance/complete-map-world-business-contract-v3.json",
  responsibility: "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v2.json",
  autonomy: "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json",
}

for (const [file, expectedSha256] of Object.entries(historicalContracts)) {
  assert(exists(file), `historical contract missing: ${file}`)
  assert(sha256(readBytes(file)) === expectedSha256, `historical contract bytes changed: ${file}`)
}
for (const file of Object.values(currentContracts)) assert(exists(file), `current contract missing: ${file}`)

const supersession = readJson("data/ai-painter/system-governance/contract-supersession-index-v1.json")
assert(supersession.policy?.historicalContractBytesMustRemainImmutable === true, "historical contract immutability policy missing")
assert(supersession.policy?.historicalContractsMayNotAuthorizeNewWork === true, "historical contracts are not execution-blocked")
for (const [historicalPath, historicalSha256] of Object.entries(historicalContracts)) {
  const records = supersession.supersessions?.filter((entry) => entry.historicalPath === historicalPath) ?? []
  assert(records.length === 1, `historical contract must have one supersession record: ${historicalPath}`)
  assert(records[0].historicalSha256 === historicalSha256, `historical supersession SHA mismatch: ${historicalPath}`)
  assert(records[0].executionStatus === "historical_read_only_not_valid_for_new_work", `historical contract is executable: ${historicalPath}`)
  assert(sha256(readBytes(records[0].successorPath)) === records[0].successorSha256, `successor SHA mismatch: ${records[0].successorPath}`)
}

const business = readJson(currentContracts.business)
assert(business.status === "active_long_term_business_contract", "business contract is not active")
assert(business.ownerAuthorizationId === undefined, "long-term business contract contains cold-start Owner authorization")
assert(business.executionGate === undefined, "long-term business contract contains task execution gates")
assert(business.releasedCapabilityRuntime?.perCandidateOwnerAuthorizationRequired === false, "business runtime still requires per-candidate Owner authorization")

const responsibility = readJson(currentContracts.responsibility)
assert(responsibility.normalAutonomousRuntimePath?.requiresReleasedCapabilityIdentity === true, "released capability identity is not required")
assert(responsibility.normalAutonomousRuntimePath?.perTaskOwnerAuthorizationRequired === false, "normal runtime still requires per-task Owner authorization")
assert(responsibility.normalAutonomousRuntimePath?.perCandidateOwnerReviewRequired === false, "normal runtime still requires per-candidate Owner review")
assert(responsibility.ownerActionRequestContract?.legacyStatusesMayBeCreated === false, "legacy Owner statuses can still be created")

const autonomy = readJson(currentContracts.autonomy)
assert(autonomy.status === "policy_active_no_capability_release", "runtime policy incorrectly implies a released capability")
assert(autonomy.authorityBoundary?.rootAuthority === "released_capability_identity", "runtime authority is not a released capability")
assert(autonomy.authorityBoundary?.perTaskOwnerAuthorizationRequired === false, "runtime autonomy still requires per-task Owner authorization")
assert(autonomy.capabilityReleaseVerification?.callerSuppliedVerifiedBooleanTrusted === false, "runtime policy trusts caller verification flags")
assert(autonomy.capabilityReleaseVerification?.ticketSha256RecomputedAtConsumption === true, "ticket integrity recheck is not required")
for (const action of ["formal_inference.start", "runtime_frame.create", "world.enter"]) {
  assert(autonomy.internalActionClasses?.includes(action), `released capability internal action missing: ${action}`)
  assert(!autonomy.capabilityChangeRequiredActionClasses?.includes(action), `runtime action incorrectly requires capability change: ${action}`)
}

const releaseRegistry = readJson("data/ai-painter/system-governance/ai-painter-capability-release-registry-v1.json")
assert(releaseRegistry.status === "active_no_capability_release", "current registry incorrectly claims a released capability")
assert(Array.isArray(releaseRegistry.releaseRecords) && releaseRegistry.releaseRecords.length === 0, "current registry must not contain a released capability")
assert(releaseRegistry.trustBoundary?.callerSuppliedVerificationFlagsAccepted === false, "release registry trusts caller flags")

const autonomySource = readText("scripts/lib/ai-painter-autonomous-package-decision-core.mjs")
for (const required of [
  "loadAndValidateReleasedCapabilityBinding",
  "readImmutableJson",
  "Owner release decision",
  "binding set SHA",
  "validateRuntimeCapabilityTicketIntegrity",
  "ticket SHA-256 mismatch",
]) assert(autonomySource.includes(required), `runtime trust implementation missing: ${required}`)
assert(!autonomySource.includes("capabilityReleaseVerified === true"), "runtime still trusts a caller verification boolean")

const config = readJson("ml/ai-painter/config/complete-world-ai-assisted-cold-start-v7.json")
assert(config.conditionChannels === 23, "V7 config does not define 23 channels")
assert(config.conditionChannelOrder?.length === 23, "V7 channel order is incomplete")
assert(new Set(config.conditionChannelOrder).size === 23, "V7 channel order contains duplicates")
const typed = [...config.conditionChannelTypes.discrete, ...config.conditionChannelTypes.continuous]
assert(typed.length === 23 && new Set(typed).size === 23, "V7 channel types do not uniquely cover all channels")
assert(config.conditionResizeContract === "discrete_nearest_continuous_bilinear_v1", "V7 resize contract mismatch")

const checkerSource = readText("scripts/check-current-world-visual-conditions.mjs")
for (const required of [
  "complete-world-ai-assisted-cold-start-v7.json",
  "conditionChannelOrder",
  "conditionChannelTypes",
  "conditionResizeContract",
  "condition channel order differs from the V7 contract",
  "condition channel value range mismatch",
]) assert(checkerSource.includes(required), `23-channel checker coverage missing: ${required}`)

const activeText = [
  "docs",
  "scripts",
  "package.json",
].flatMap((entry) => collectText(entry)).join("\n")
for (const retired of Object.keys(historicalContracts)) assert(!activeText.includes(retired), `active source still uses historical contract: ${retired}`)
for (const current of Object.values(currentContracts)) assert(activeText.includes(current), `active documentation does not reference current contract: ${current}`)

console.log(JSON.stringify({
  ok: true,
  status: "ai_painter_document_machine_contract_semantic_alignment_passed",
  historicalContractsRetainedImmutable: Object.keys(historicalContracts),
  historicalContractsBlockedForNewWork: true,
  currentContracts: Object.values(currentContracts),
  currentCapabilityReleaseStatus: "none_released",
  conditionChannelsVerified: 23,
  runtimeActionsAutonomousWithinReleasedCapability: ["formal_inference.start", "runtime_frame.create", "world.enter"],
}, null, 2))

function collectText(relativePath) {
  const absolute = path.resolve(ROOT, relativePath)
  if (!fs.existsSync(absolute)) return []
  if (fs.statSync(absolute).isFile()) return [fs.readFileSync(absolute, "utf8")]
  const result = []
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue
    if (entry.name === "check-ai-painter-contract-semantic-alignment.mjs") continue
    if (entry.name === "contract-supersession-index-v1.json") continue
    const child = path.join(absolute, entry.name)
    if (entry.isDirectory()) result.push(...collectText(path.relative(ROOT, child)))
    else if (/\.(md|mjs|js|json)$/.test(entry.name)) result.push(fs.readFileSync(child, "utf8"))
  }
  return result
}

function readJson(relativePath) { return JSON.parse(readText(relativePath)) }
function readText(relativePath) { return fs.readFileSync(path.resolve(ROOT, relativePath), "utf8") }
function readBytes(relativePath) { return fs.readFileSync(path.resolve(ROOT, relativePath)) }
function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex") }
function exists(relativePath) { return fs.existsSync(path.resolve(ROOT, relativePath)) }
function assert(condition, message) { if (!condition) throw new Error(message) }
