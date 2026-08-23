import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const oldContracts = [
  "data/ai-painter/system-governance/ai-painter-autonomous-package-decision-contract-v1.json",
  "data/ai-painter/system-governance/complete-map-world-training-and-dynamic-readiness-contract-v2.json",
  "data/ai-painter/system-governance/local-ai-responsibility-contract-v1.json",
]
const currentContracts = {
  business: "data/ai-painter/system-governance/complete-map-world-business-contract-v3.json",
  responsibility: "data/ai-painter/system-governance/local-ai-operating-responsibility-contract-v2.json",
  autonomy: "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json",
}

for (const file of oldContracts) assert(!exists(file), `retired contract still exists: ${file}`)
for (const file of Object.values(currentContracts)) assert(exists(file), `current contract missing: ${file}`)

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
assert(autonomy.authorityBoundary?.rootAuthority === "released_capability_identity", "runtime authority is not a released capability")
assert(autonomy.authorityBoundary?.perTaskOwnerAuthorizationRequired === false, "runtime autonomy still requires per-task Owner authorization")
for (const action of ["formal_inference.start", "runtime_frame.create", "world.enter"]) {
  assert(autonomy.internalActionClasses?.includes(action), `released capability internal action missing: ${action}`)
  assert(!autonomy.capabilityChangeRequiredActionClasses?.includes(action), `runtime action incorrectly requires capability change: ${action}`)
}

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
  ".gitignore",
].flatMap((entry) => collectText(entry)).join("\n")
for (const retired of oldContracts) assert(!activeText.includes(retired), `active source still references retired contract: ${retired}`)
for (const current of Object.values(currentContracts)) assert(activeText.includes(current), `active documentation does not reference current contract: ${current}`)

console.log(JSON.stringify({
  ok: true,
  status: "ai_painter_document_machine_contract_semantic_alignment_passed",
  retiredContractsAbsent: oldContracts,
  currentContracts: Object.values(currentContracts),
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
    const child = path.join(absolute, entry.name)
    if (entry.isDirectory()) result.push(...collectText(path.relative(ROOT, child)))
    else if (/\.(md|mjs|js|json)$/.test(entry.name)) result.push(fs.readFileSync(child, "utf8"))
  }
  return result
}

function readJson(relativePath) { return JSON.parse(readText(relativePath)) }
function readText(relativePath) { return fs.readFileSync(path.resolve(ROOT, relativePath), "utf8") }
function exists(relativePath) { return fs.existsSync(path.resolve(ROOT, relativePath)) }
function assert(condition, message) { if (!condition) throw new Error(message) }
