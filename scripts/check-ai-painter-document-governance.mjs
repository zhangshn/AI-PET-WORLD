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
  if (text.includes(forbidden)) failures.push(`${relativePath}: contains retired current-authority rule: ${forbidden}`)
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
    ["document status", /^文档状态：`[^`]+`$/m],
  ]) {
    if (!pattern.test(text)) failures.push(`${relativePath}: missing ${label}`)
  }
  if (/^批准状态：/m.test(text)) failures.push(`${relativePath}: retired approval-status metadata must not be current`)
}

for (const [relativePath, expected] of [
  ["AGENTS.md", "不需要逐任务、逐阶段、逐版本或逐次运行的Owner签名与批准"],
  ["AGENTS.md", "本地内部任务票据只用于幂等、防重、状态转换、资源配额和证据追溯"],
  ["docs/DOCUMENT_AUTHORITY_INDEX.md", "不得把版本化治理重新解释为逐任务、逐阶段或逐版本的人工审批"],
  ["docs/DOCUMENTATION_POLICY.md", "内部票据只承担幂等与证据职责"],
  ["docs/BUSINESS_SPEC.md", "每次正式候选仍必须重新形成并审核一张原生`1024×768`完整RGB"],
  ["docs/ARCHITECTURE.md", "blocked_business_boundary"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "项目所有者不承担逐任务或逐版本操作员职责"],
  ["docs/DIRECTORY_STRUCTURE.md", "内部票据只承担幂等、防重、状态转换和证据追溯"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "AI-PAINTER-SPEC-1.3"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "### 12.2 自主能力生命周期与机器发布规范"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "createdBy = local_ai_capability_lifecycle_orchestrator"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "后继机器合同待程序接入阶段物化"],
  ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", "machine_qualified_positive"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "上述状态均不是等待Owner日常批准"],
  ["docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md", "固定进度3/5（60%）"],
  ["docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md", "训练未运行"],
  ["docs/game-world-generation/DOCUMENT_INDEX.md", "自主能力生命周期"],
  [".gitattributes", "*.md text eol=lf"],
]) requireText(relativePath, expected)

const activeAuthorityDocuments = [
  "AGENTS.md",
  "docs/DOCUMENT_AUTHORITY_INDEX.md",
  "docs/DOCUMENTATION_POLICY.md",
  "docs/BUSINESS_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md",
  "docs/DIRECTORY_STRUCTURE.md",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
]

for (const relativePath of activeAuthorityDocuments) {
  for (const forbidden of [
    "waiting_owner_decision",
    "completed_waiting_capability_release",
    "ai-painter-capability-release-owner-decision-v1",
    "冷启动能力版本发布前另需项目级发布验收",
  ]) forbidText(relativePath, forbidden)
}

for (const [relativePath, forbidden] of [
  ["AGENTS.md", "任何写操作必须验证不可变Owner授权文件"],
  ["AGENTS.md", "训练、验证、正式推理、RuntimeFrame和`/world`分别授权"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "Codex或其他外部智能体每次行动都需要项目所有者明确授权"],
  ["docs/DOCUMENTATION_POLICY.md", "任何写操作必须验证并原子消费Owner授权"],
]) forbidText(relativePath, forbidden)

// Historical contracts stay byte-preserved for old-run audits. This checker
// verifies only that boundary; it deliberately does not certify the current
// JSON successors as the autonomous runtime. Program adoption is a later task.
const supersessionPath = "data/ai-painter/system-governance/contract-supersession-index-v1.json"
requireFile(supersessionPath)
let historicalContractsVerified = 0
if (fs.existsSync(path.join(ROOT, supersessionPath))) {
  const supersession = readJson(supersessionPath)
  if (supersession.policy?.historicalContractBytesMustRemainImmutable !== true) failures.push("historical contract bytes must remain immutable")
  if (supersession.policy?.historicalContractsMayNotAuthorizeNewWork !== true) failures.push("historical contracts must not authorize new work")
  if (!Array.isArray(supersession.supersessions) || supersession.supersessions.length === 0) failures.push("historical contract supersession entries are missing")
  for (const entry of supersession.supersessions ?? []) {
    requireFile(entry.historicalPath)
    if (fs.existsSync(path.join(ROOT, entry.historicalPath)) && sha256(entry.historicalPath) !== entry.historicalSha256) {
      failures.push(`${entry.historicalPath}: historical SHA-256 mismatch`)
    }
    if (entry.executionStatus !== "historical_read_only_not_valid_for_new_work") failures.push(`${entry.historicalPath}: invalid retired execution status`)
    historicalContractsVerified += 1
  }
}

if (failures.length > 0) {
  console.error("AI Painter document governance check failed:")
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  status: "ai_painter_document_semantics_passed_machine_contract_adoption_pending",
  versionedDocuments: versionedDocuments.length,
  historicalContractsVerified,
  currentMachineContractAdoption: "not_claimed_by_document_check",
  fixedAiPainterProgress: "3/5 (60%)",
}, null, 2))
