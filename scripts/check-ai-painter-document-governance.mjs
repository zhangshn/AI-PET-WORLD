import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const failures = []

const readText = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8")
const readJson = (relativePath) => JSON.parse(readText(relativePath))
const sha256 = (relativePath) => crypto
  .createHash("sha256")
  .update(fs.readFileSync(path.join(ROOT, relativePath)))
  .digest("hex")

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) failures.push(`${relativePath}: missing`)
}

function requireText(relativePath, expected) {
  const text = readText(relativePath)
  if (!text.includes(expected)) failures.push(`${relativePath}: missing required text: ${expected}`)
}

function forbidText(relativePath, forbidden) {
  const text = readText(relativePath)
  if (text.includes(forbidden)) failures.push(`${relativePath}: contains retired authority rule: ${forbidden}`)
}

const versionedDocuments = [
  "README.md",
  "docs/DOCUMENT_AUTHORITY_INDEX.md",
  "docs/DOCUMENTATION_POLICY.md",
  "docs/BUSINESS_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md",
  "docs/DIRECTORY_STRUCTURE.md",
  "docs/game-world-generation/README.md",
  "docs/game-world-generation/DOCUMENT_INDEX.md",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
]

for (const relativePath of versionedDocuments) {
  requireFile(relativePath)
  if (!fs.existsSync(path.join(ROOT, relativePath))) continue
  const text = readText(relativePath)
  for (const [label, pattern] of [
    ["document version", /^文档版本：`[^`]+`$/m],
    ["effective date", /^生效日期：`\d{4}-\d{2}-\d{2}`$/m],
    ["approval status", /^批准状态：`[^`]+`$/m],
  ]) {
    if (!pattern.test(text)) failures.push(`${relativePath}: missing ${label}`)
  }
}

for (const [relativePath, forbidden] of [
  ["AGENTS.md", "任何写操作必须验证不可变Owner授权文件"],
  ["AGENTS.md", "训练、验证、正式推理、RuntimeFrame和`/world`分别授权"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "Codex或其他外部智能体每次行动都需要项目所有者明确授权"],
  ["docs/DOCUMENTATION_POLICY.md", "任何写操作必须验证并原子消费Owner授权"],
]) forbidText(relativePath, forbidden)

for (const [relativePath, expected] of [
  ["AGENTS.md", "已发布能力版本内已经冻结声明的正式生成、固定验证、机器审核、失败关闭"],
  ["AGENTS.md", "不得再次要求逐任务Owner授权"],
  ["docs/DOCUMENT_AUTHORITY_INDEX.md", "contract-supersession-index-v1.json"],
  ["docs/DOCUMENT_AUTHORITY_INDEX.md", "ai-painter-capability-release-registry-v1.json"],
  ["docs/DOCUMENTATION_POLICY.md", "不逐任务消费Owner授权"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "已发布能力版本内"],
  ["docs/DIRECTORY_STRUCTURE.md", "capability-runtime-executions"],
  ["docs/DIRECTORY_STRUCTURE.md", "data/ai-painter/capability-releases/<capabilityReleaseIdentity>/"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "AI-PAINTER-SPEC-1.2"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "### 12.2 能力发布文件与受信注册规范"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "ai-painter-capability-release-owner-decision-v1"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "datasetRelease"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "runtimeInterfaceContract"],
  ["docs/game-world-generation/DOCUMENT_INDEX.md", "历史机器合同必须保留原始字节"],
]) requireText(relativePath, expected)

const registryPath = "data/ai-painter/system-governance/ai-painter-capability-release-registry-v1.json"
const supersessionPath = "data/ai-painter/system-governance/contract-supersession-index-v1.json"
const runtimePolicyPath = "data/ai-painter/system-governance/ai-painter-capability-runtime-autonomy-contract-v2.json"
for (const relativePath of [registryPath, supersessionPath, runtimePolicyPath]) requireFile(relativePath)

const registry = readJson(registryPath)
if (registry.schemaVersion !== "ai-painter-capability-release-registry-v1") failures.push("trusted release registry schema mismatch")
if (registry.status !== "active_no_capability_release") failures.push("trusted release registry must explicitly state that no capability is released")
if (!Array.isArray(registry.releaseRecords) || registry.releaseRecords.length !== 0) failures.push("documentation baseline must not claim a released AI Painter capability")
if (registry.trustBoundary?.callerSuppliedVerificationFlagsAccepted !== false) failures.push("trusted registry must reject caller-supplied verification flags")

const runtimePolicy = readJson(runtimePolicyPath)
if (runtimePolicy.status !== "policy_active_no_capability_release") failures.push("runtime policy status must distinguish active policy from released capability")
if (runtimePolicy.authorityBoundary?.rootAuthority !== "released_capability_identity") failures.push("runtime policy root authority must be a verified released capability")
if (runtimePolicy.authorityBoundary?.perTaskOwnerAuthorizationRequired !== false) failures.push("released runtime must not require per-task Owner authorization")
if (runtimePolicy.capabilityReleaseVerification?.ticketSha256RecomputedAtConsumption !== true) failures.push("ticket SHA-256 must be recomputed at consumption")

const supersession = readJson(supersessionPath)
if (supersession.policy?.historicalContractBytesMustRemainImmutable !== true) failures.push("historical contract bytes must remain immutable")
if (supersession.policy?.historicalContractsMayNotAuthorizeNewWork !== true) failures.push("historical contracts must not authorize new work")
if (!Array.isArray(supersession.supersessions) || supersession.supersessions.length !== 3) failures.push("exactly three retired contracts must be registered")
for (const entry of supersession.supersessions ?? []) {
  for (const role of ["historicalPath", "successorPath"]) requireFile(entry[role])
  if (fs.existsSync(path.join(ROOT, entry.historicalPath)) && sha256(entry.historicalPath) !== entry.historicalSha256) {
    failures.push(`${entry.historicalPath}: historical SHA-256 mismatch`)
  }
  if (fs.existsSync(path.join(ROOT, entry.successorPath)) && sha256(entry.successorPath) !== entry.successorSha256) {
    failures.push(`${entry.successorPath}: successor SHA-256 mismatch`)
  }
  if (entry.executionStatus !== "historical_read_only_not_valid_for_new_work") failures.push(`${entry.historicalPath}: invalid retired execution status`)
}

if (failures.length > 0) {
  console.error("AI Painter document governance check failed:")
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  status: "ai_painter_document_and_machine_contract_governance_passed",
  versionedDocuments: versionedDocuments.length,
  historicalContractsVerified: supersession.supersessions.length,
  releasedCapabilities: registry.releaseRecords.length,
  runtimePolicyStatus: runtimePolicy.status,
}, null, 2))
