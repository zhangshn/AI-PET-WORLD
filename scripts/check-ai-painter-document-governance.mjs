import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { validateAiPainterDocumentState, validateProgramAdoptionDeclaration } from "./lib/ai-painter-document-governance-state.mjs"

import { readFrozenAiPainterSpecification, FROZEN_AI_PAINTER_SPECIFICATION } from "./lib/ai-painter-frozen-document-v1.mjs"

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

function requireRegex(relativePath, pattern, label) {
  const text = readText(relativePath)
  if (!pattern.test(text)) failures.push(`${relativePath}: missing or invalid ${label}`)
}

function forbidRegex(relativePath, pattern, label) {
  const text = readText(relativePath)
  if (pattern.test(text)) failures.push(`${relativePath}: contains forbidden ${label}`)
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length
}

function extractCodeBlockAfterHeading(text, heading) {
  const headingIndex = text.indexOf(heading)
  if (headingIndex < 0) return null
  const tail = text.slice(headingIndex + heading.length)
  const match = tail.match(/```text\s*\r?\n([\s\S]*?)\r?\n```/)
  return match?.[1]?.replaceAll("\r", "").trim() ?? null
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
  "docs/world-visual-data-dictionary/README.md",
]

const implementationBearingDocuments = [
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

const exactDocumentVersions = new Map([
  ["docs/DOCUMENT_AUTHORITY_INDEX.md", "DOCUMENT-AUTHORITY-1.9"],
  ["docs/DOCUMENTATION_POLICY.md", "DOCUMENTATION-POLICY-1.6"],
  ["docs/BUSINESS_SPEC.md", "AI-PET-WORLD-BUSINESS-1.6"],
  ["docs/ARCHITECTURE.md", "AI-PET-WORLD-ARCHITECTURE-1.10"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "LOCAL-AI-CAPABILITY-MIGRATION-1.7"],
  ["docs/DIRECTORY_STRUCTURE.md", "AI-PET-WORLD-DIRECTORY-1.12"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "AI-PAINTER-SPEC-1.86"],
  ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", "AI-PAINTER-DATA-PROVENANCE-1.7"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "AI-PAINTER-REVIEW-STORAGE-1.20"],
  ["docs/world-visual-data-dictionary/README.md", "WORLD-VISUAL-DICTIONARY-REFERENCE-1.0"],
])

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

for (const relativePath of implementationBearingDocuments) {
  const text = readText(relativePath)
  if (!/^文档状态：`active_normative_target`$/m.test(text)) failures.push(`${relativePath}: normative target status mismatch`)
  failures.push(...validateProgramAdoptionDeclaration(text).failures.map(failure => `${relativePath}: ${failure}`))
}

for (const [relativePath, version] of exactDocumentVersions) {
  requireRegex(relativePath, new RegExp(`^\u6587\u6863\u7248\u672c\uff1a\`${version.replaceAll(".", "\\.")}\`$`, "m"), `current document version ${version}`)
}

for (const [relativePath, expected] of [
  ["AGENTS.md", "不需要逐任务、逐阶段、逐版本或逐次运行的Owner签名与批准"],
  ["AGENTS.md", "本地内部任务票据只用于幂等、防重、状态转换、资源配额和证据追溯"],
  ["AGENTS.md", "`GOV-OWNER-001`"],
  ["docs/DOCUMENT_AUTHORITY_INDEX.md", "### GOV-OWNER-001：Owner不进入本地AI正常运行状态机"],
  ["docs/DOCUMENT_AUTHORITY_INDEX.md", "程序不得生成等待Owner授权、签名、批准或响应的正常状态"],
  ["docs/DOCUMENTATION_POLICY.md", "内部票据只承担幂等与证据职责"],
  ["docs/DOCUMENTATION_POLICY.md", "### 7.2 仓库CPU回归与完整本地验收"],
  ["docs/DOCUMENTATION_POLICY.md", "`qualificationGranted=false`、`realAssetAudit=not_run`"],
  ["docs/DOCUMENTATION_POLICY.md", "完整本地资格验证器必须拒绝便携摘要"],
  ["docs/BUSINESS_SPEC.md", "`GOV-OWNER-001`"],
  ["docs/BUSINESS_SPEC.md", "### 3.2 分段交付与前期最小范围"],
  ["docs/BUSINESS_SPEC.md", "延期的是精修工作，不是容许已声明的事实错位、漏画或伪造"],
  ["docs/BUSINESS_SPEC.md", "256×192是训练阶段，不是正式世界画面的替代品"],
  ["docs/ARCHITECTURE.md", "人格与人物最小行动能力不依赖动物或建设能力"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "进程存活不等于流程闭环"],
  ["docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md", "模块2与3是并列主线"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "不能由结果失败后临时改判“不适用”"],
  ["docs/BUSINESS_SPEC.md", "每次正式候选仍必须重新形成并审核一张原生`1024×768`完整RGB"],
  ["docs/ARCHITECTURE.md", "blocked_policy_boundary"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "Owner可以主动改变业务目标、观察、暂停或紧急停止，但不进入本地AI正常运行状态机"],
  ["docs/DIRECTORY_STRUCTURE.md", "内部票据只承担幂等、防重、状态转换和证据追溯"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "替代版本：`AI-PAINTER-SPEC-1.85`"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "240秒仅适用于本节诊断的完整CPU组件验收及其最终新程序自身受管CPU预检"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "#### 9.6.38 生态条件模型的训练生命周期组件"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "#### 9.6.39 生态模型梯度故障的单次有界采集"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "##### 9.6.39.1 CPU负向输入夹具与生产输出隔离"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "CPU-NI-006 完成与失败"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "##### 9.6.39.2 本轮心跳的单句柄一致读取"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "CTRL-HB-006 证据与准入"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "### 11.14 CPU负向输入的限定链接与资源计量"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "#### 9.6.40 生态模型的单次短程画质验证"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "#### 9.6.41 保存故障状态的单样本梯度因果诊断"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "GC-005 证据与后继"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "NS-006 结果和停止"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "### 11.15 本地操作者入口与同调用安全停止"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "DEP-AUTH-005 验收分层"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "本节诊断CPU调用含启动及终态最多240秒"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "#### 9.6.37 现有生态类别条件的隔离CPU原型"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "CPU通过不证明画质改善"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "#### 9.6.20 四类对象共享隐藏层的有界CPU候选"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "当前阶段只建立并验证CPU候选"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "共享层只注册一次"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "#### 9.6.21 共享隐藏层CPU检查器的状态身份修复后继"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "#### 9.6.22 同一V27模型的完整程序依赖检查修复"],
  ["data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt", "state_hash(module.state_dict())"],
  ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", "### 9.1 单世界先行MVP的阶段隔离"],
  ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", "deferred_out_of_current_mvp_scope"],
  ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", "不能通过删除整个历史审核结果放行"],
  ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", "超范围自动恢复完整要求"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "#### 9.4.1 独立CPU只读基础资产加载验证"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "### 12.2 自主能力生命周期与机器发布规范"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "createdBy = local_ai_capability_release_orchestrator"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "单包自动闭环"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "唯一写入主体为`local_ai_capability_release_orchestrator`"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "`GOV-OWNER-001`"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "37条稳定需求逐项追踪"],
  ["docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md", "machine_qualified_positive"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "以上状态均不是等待Owner批准"],
  ["docs/game-world-generation/DOCUMENT_INDEX.md", "自主能力生命周期"],
  ["docs/world-visual-data-dictionary/README.md", "旧Owner词汇不得授权、阻断、恢复、发布或回退当前任务"],
  ["docs/world-visual-data-dictionary/README.md", "当前Owner职责只采用`docs/DOCUMENT_AUTHORITY_INDEX.md`中的`GOV-OWNER-001`"],
  ["docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md", "不具有当前执行效力"],
  [".gitattributes", "*.md text eol=lf"],
]) requireText(relativePath, expected)

for (const [relativePath, forbidden, label] of [
  ["docs/world-visual-data-dictionary/README.md", /必须先获得项目所有者命令/, "Owner approval in current dictionary maintenance"],
  ["docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md", /任何 RuntimeFrame 仍必须经过项目所有者人工最终验收/, "per-frame Owner acceptance"],
  ["docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md", /必须先停下来询问项目所有者/, "Owner blocking in generated dictionary print"],
]) forbidRegex(relativePath, forbidden, label)

const ownerDefinitionHeading = "### GOV-OWNER-001：Owner不进入本地AI正常运行状态机"
const ownerDefinitionCount = activeAuthorityDocuments
  .map((relativePath) => countMatches(readText(relativePath), /^### GOV-OWNER-001：Owner不进入本地AI正常运行状态机$/gm))
  .reduce((sum, count) => sum + count, 0)
if (ownerDefinitionCount !== 1) failures.push(`GOV-OWNER-001 must have exactly one normative definition, found ${ownerDefinitionCount}`)
requireText("docs/DOCUMENT_AUTHORITY_INDEX.md", ownerDefinitionHeading)
for (const relativePath of [
  "docs/BUSINESS_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
]) requireText(relativePath, "GOV-OWNER-001")

for (const [relativePath, forbidden, label] of [
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", /迁移与备份删除需要单独授权/, "ambiguous separate authorization gate"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", /所有者切换决定/, "Owner migration switch decision"],
  ["docs/DIRECTORY_STRUCTURE.md", /owner-approved world-connectivity blueprint/, "Owner-approved current data dependency"],
  ["docs/BUSINESS_SPEC.md", /唯一模块计划表批准的业务范围/, "plan-table approval wording"],
]) forbidRegex(relativePath, forbidden, label)

for (const relativePath of [
  "docs/DOCUMENT_AUTHORITY_INDEX.md",
  "docs/ARCHITECTURE.md",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
]) {
  for (const identity of ["currentProjectTask", "activeExecution", "latestTrainingTerminal", "selectedHistoricalRun"]) {
    requireText(relativePath, identity)
  }
  requireText(relativePath, "unknown_or_stale")
}

requireText("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "它们描述业务责任，不等同于 Stage 0、Stage 1、Stage 2 的训练分辨率")
requireText("docs/ARCHITECTURE.md", "该内部责任链不得与 `Stage 0/1/2` 的训练分辨率阶段混淆")
requireRegex(
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  /现有迁移实现使用\s*12\s*通道潜变量/u,
  "current 12-channel latent implementation classified as a versioned value",
)
requireRegex(
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  /complete-world-ai-assisted-cold-start-v7\.json[^\n]*(?:未发布旧实现|历史迁移输入)[^\n]*(?:不得被当前检查器|不得.*当前)/,
  "V7 migration input retirement semantics",
)
requireText("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "它们可以通过新能力版本替换，但不得被写成永久业务规则")
requireText("docs/DOCUMENT_AUTHORITY_INDEX.md", "文档是否生效与程序是否已全部实现是两个独立结论")
requireText("docs/DOCUMENTATION_POLICY.md", "active_normative_target")
requireText("docs/DOCUMENTATION_POLICY.md", "program_adoption_pending")

for (const machineContract of [
  "data/ai-painter/system-governance/ai-painter-capability-lifecycle-contract-v1.json",
  "data/ai-painter/system-governance/ai-painter-autonomous-closed-loop-contract-v1.json",
  "data/ai-painter/system-governance/ai-painter-current-entrypoint-registry-v1.json",
  "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json",
  "data/ai-painter/system-governance/stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json",
  "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json",
  "data/ai-painter/system-governance/ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1.json",
]) requireFile(machineContract)

const stage4V2ParentPath = "data/ai-painter/system-governance/stage4-full-resolution-typed-semantic-transport-rgb-responsibility-contract-v2.json"
if (fs.existsSync(path.join(ROOT, stage4V2ParentPath))) {
  const parent = readJson(stage4V2ParentPath)
  for (const [role, binding, expectedPath] of [
    ["trainer/loss", parent.lossContract, "data/ai-painter/system-governance/stage4-semantic-transport-v2-trainer-loss-support-contract-v1.json"],
    ["review threshold", parent.reviewThresholdContract, "data/ai-painter/system-governance/ai-painter-stage4-v2-machine-review-threshold-contract-v1.json"],
    ["foundation Autoencoder", parent.foundationAssetBinding, "data/ai-painter/system-governance/ai-painter-stage4-v2-project-foundation-autoencoder-lineage-contract-v1.json"],
  ]) {
    if (binding?.path !== expectedPath) failures.push(`Stage4 V2 ${role} binding path mismatch`)
    if (!/^[a-f0-9]{64}$/u.test(binding?.sha256 ?? "")) failures.push(`Stage4 V2 ${role} binding SHA-256 is invalid`)
    else if (fs.existsSync(path.join(ROOT, expectedPath)) && sha256(expectedPath) !== binding.sha256) failures.push(`Stage4 V2 ${role} binding SHA-256 mismatch`)
  }
}

for (const [relativePath, expected] of [
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "CPU阶段仅校验路径、文件SHA、结构与加载程序，不反序列化权重"],
  ["docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "未来加载、训练前和训练后必须补齐相同状态SHA及优化器排除证据"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "逐项交叉验证`registryRevision`、`packageId`、数据发布身份、候选RGB、条件包、参考RGB、四类对象掩码及阈值合同绑定"],
  ["docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md", "north/south或特定port不是所有有水样本的通用要求"],
]) requireText(relativePath, expected)

for (const relativePath of activeAuthorityDocuments.filter((value) => value !== "docs/DOCUMENT_AUTHORITY_INDEX.md")) {
  for (const forbidden of [
    "waiting_owner_decision",
    "completed_waiting_capability_release",
    "ai-painter-capability-release-owner-decision-v1",
    "冷启动能力版本发布前另需项目级发布验收",
    "blocked_business_boundary",
    "capability_candidate",
    "capability_qualification_in_progress",
    "capability_release_machine_passed",
    "capability_release_machine_rejected",
    "capability_release_rolled_back",
    "capability_release_machine_reviewing",
  ]) forbidText(relativePath, forbidden)
}

const forbiddenRuntimeOwnerTokens = [
  "waiting_owner_authorization",
  "waiting_owner_decision",
  "completed_waiting_owner_review",
  "completed_waiting_separate_authorization",
  "completed_waiting_capability_release",
  "owner_action_request",
  "owner_release_decision",
  "owner_signature_required",
]
for (const relativePath of activeAuthorityDocuments.filter((value) => value !== "docs/DOCUMENT_AUTHORITY_INDEX.md")) {
  const text = readText(relativePath).toLowerCase()
  for (const token of forbiddenRuntimeOwnerTokens) {
    if (text.includes(token)) failures.push(`${relativePath}: forbidden Owner runtime token: ${token}`)
  }
}

const architecture = readText("docs/ARCHITECTURE.md")
const reviewSpec = readText("docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md")
const capabilityArchitecture = extractCodeBlockAfterHeading(architecture, "### 0.4.1 能力生命周期")
const executionArchitecture = extractCodeBlockAfterHeading(architecture, "### 0.4.2 单次执行生命周期")
const reviewArchitecture = extractCodeBlockAfterHeading(architecture, "### 0.4.3 机器审核生命周期")
const capabilityReviewSpec = extractCodeBlockAfterHeading(reviewSpec, "能力生命周期只使用总体架构第0.4节定义的正式状态：")
const executionReviewSpec = extractCodeBlockAfterHeading(reviewSpec, "正式状态不得由控制台另行命名。单次执行只使用总体架构第0.4节定义的执行生命周期：")

if (!capabilityArchitecture || capabilityArchitecture !== capabilityReviewSpec) failures.push("capability lifecycle differs between architecture and review specification")
if (!executionArchitecture || executionArchitecture !== executionReviewSpec) failures.push("execution lifecycle differs between architecture and review specification")
if (!reviewArchitecture) failures.push("architecture review lifecycle is missing")
if (!reviewSpec.includes("审核只使用`review_pending -> review_running -> review_passed / review_failed / review_evidence_conflict`")) failures.push("review specification does not reference the canonical review lifecycle")

const formalSpec = readText("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md")
const capabilityFormalSpec = extractCodeBlockAfterHeading(formalSpec, "### 12.2 自主能力生命周期与机器发布规范")
if (!capabilityArchitecture || capabilityArchitecture !== capabilityFormalSpec) failures.push("capability lifecycle differs between architecture and formal AI Painter specification")
const { failures: documentStateFailures, ...documentState } = validateAiPainterDocumentState(
  formalSpec,
  readText("docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"),
)
failures.push(...documentStateFailures)
failures.push(...validateProgramAdoptionDeclaration(formalSpec, documentState.documentedStatusCounts).failures)

// These normative boundaries must remain explicit even when a future trace
// row declares machine_conformant. Authenticity belongs to machine checks.
requireText("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "只有机器合同、程序实现、正反测试和本地运行证据四层同时存在且身份一致时")
requireText("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "文档检查通过本身不能提升程序符合状态")
requireText("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "Owner签名、聊天、调用方布尔字段、页面身份、外部智能体记忆和历史授权包都不是发布条件或发布证明")

const packageJson = readJson("package.json")
const documentCheckCommand = packageJson.scripts?.["check:ai-painter-document-contracts"] ?? ""
for (const retiredProgramCheck of [
  "check-ai-painter-contract-semantic-alignment.mjs",
  "check-ai-painter-autonomous-package-decision-core.mjs",
]) {
  if (documentCheckCommand.includes(retiredProgramCheck)) failures.push(`document-only check still certifies retired program contract: ${retiredProgramCheck}`)
}

for (const [relativePath, forbidden] of [
  ["AGENTS.md", "任何写操作必须验证不可变Owner授权文件"],
  ["AGENTS.md", "训练、验证、正式推理、RuntimeFrame和`/world`分别授权"],
  ["docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "Codex或其他外部智能体每次行动都需要项目所有者明确授权"],
  ["docs/DOCUMENTATION_POLICY.md", "任何写操作必须验证并原子消费Owner授权"],
]) forbidText(relativePath, forbidden)

// Historical contracts stay byte-preserved for old-run audits. This checker
// verifies only the document boundary; current program adoption is verified by
// the separate machine-contract semantic-alignment check.
const supersessionPath = "data/ai-painter/system-governance/contract-supersession-index-v2.json"
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


const frozenSpecification = readFrozenAiPainterSpecification(ROOT, { purpose: "historical_review" })
const frozenClauseIndexPath = "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-clauses-v1.json"
const frozenClauseIndex = readJson(frozenClauseIndexPath)
if (frozenClauseIndex.allowedPurpose !== "historical_review" || frozenClauseIndex.executionAllowed !== false ||
    frozenClauseIndex.qualificationGranted !== false || frozenClauseIndex.logicalPath !== FROZEN_AI_PAINTER_SPECIFICATION.path ||
    frozenClauseIndex.documentVersion !== FROZEN_AI_PAINTER_SPECIFICATION.version ||
    frozenClauseIndex.snapshot?.path !== FROZEN_AI_PAINTER_SPECIFICATION.archivePath ||
    frozenClauseIndex.snapshot?.sha256 !== FROZEN_AI_PAINTER_SPECIFICATION.sha256 ||
    frozenClauseIndex.snapshot?.bytes !== FROZEN_AI_PAINTER_SPECIFICATION.byteSize) {
  failures.push("frozen clause index identity or non-executable scope differs")
}
const frozenLines = frozenSpecification.bytes.toString("utf8").replaceAll("\r\n", "\n").split("\n")
requireText(".gitattributes", "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt -text")
const frozenHeadings = [...frozenSpecification.bytes.toString("utf8").replaceAll("\r\n", "\n")
  .matchAll(/^#### (9\.6\.\d+) (.+)$/gm)]
if (frozenClauseIndex.sections?.length !== 42 || frozenHeadings.length !== 42) failures.push("expected 42 frozen research clauses")
for (const [index, clause] of (frozenClauseIndex.sections ?? []).entries()) {
  const nextHeading = frozenHeadings[index + 1]
  const terminalHeading = frozenLines.findIndex(line => line === "## 10. 自动验证与机器审核")
  const expectedEnd = nextHeading
    ? frozenSpecification.bytes.toString("utf8").replaceAll("\r\n", "\n").slice(0, nextHeading.index).split("\n").length - 1
    : terminalHeading
  if (clause.sectionId !== `9.6.${index + 1}` || clause.dispatchable !== false || clause.scope !== "original_frozen_version_only" ||
      !Number.isInteger(clause.startLine) || !Number.isInteger(clause.endLine) || clause.endLine < clause.startLine ||
      clause.endLine !== expectedEnd ||
      frozenLines[clause.startLine - 1] !== `#### ${clause.sectionId} ${clause.title}` ||
      clause.endLine >= frozenLines.length) failures.push(`invalid frozen clause locator: ${clause.sectionId}`)
}
requireText("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "### 17.4 程序符合声明的转换规则")
requireText("docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", "E-TRACE-01")

if (failures.length > 0) {
  console.error("AI Painter document governance check failed:")
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  status: "ai_painter_document_semantics_passed",
  versionedDocuments: versionedDocuments.length,
  historicalContractsVerified,
  historicalDocumentSnapshotsVerified: 1,
  frozenResearchClausesVerified: 42,
  currentMachineContractAdoption: "not_evaluated_by_document_check",
  ...documentState,
}, null, 2))
