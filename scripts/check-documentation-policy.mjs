import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const DOCS_ROOT = path.join(ROOT, "docs")
const REQUIRED_SENTENCE = "不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。"
const TIMESTAMP_PATTERN = /更新时间：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+08:00/
const STATUS_PATTERN = /^状态：\S.+$/m

const REQUIRED_GOVERNED_DOCS = [
  "README.md",
  "AGENTS.md",
  "docs/DOCUMENT_AUTHORITY_INDEX.md",
  "docs/DOCUMENTATION_POLICY.md",
  "docs/BUSINESS_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md",
  "docs/DIRECTORY_STRUCTURE.md",
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  "docs/game-world-generation/README.md",
  "docs/game-world-generation/DOCUMENT_INDEX.md",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
  "docs/game-world-generation/FLOWING_WATER_CONNECTIVITY_AND_NOVELTY_SPEC.md",
  "docs/game-world-generation/CROSS_MODAL_RGB_COLLAPSE_PREVENTION_SPEC.md",
  "docs/game-world-generation/CROSS_MODAL_RGB_GATE_THRESHOLD_ALIGNMENT_20260802.md",
  "docs/world-visual-data-dictionary/README.md",
  "docs/ai-painter-progress/README.md",
  "docs/ai-painter-progress/GENERATED_RESULTS_PAGE_LOCKED_SPEC.md",
  "docs/ai-painter-progress/TRAINING_DATA_PERSISTENCE_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AI_MODEL_TRAINING_ARCHITECTURE_ALIGNMENT.md",
  "docs/ai-painter-progress/AI_PAINTER_CONSOLE_PAGE_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AI_PAINTER_ADMIN_BACKEND_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AUTO_REPAIR_PLAN_RUNNER_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AUTO_VISUAL_JUDGE_LEARNING_LOCKED_SPEC_20260709.md",
  "docs/ai-painter-progress/ORIGINAL_IMAGE_LIBRARY_LOCKED_SPEC.md",
  "docs/ai-painter-progress/CURRENT_TRAINING_BACKEND_CONSOLE_LOCKED_SPEC.md",
  "docs/ziwei/README.md",
]

const EXACT_GAME_WORLD_DOCUMENTS = [
  "docs/game-world-generation/README.md",
  "docs/game-world-generation/DOCUMENT_INDEX.md",
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
  "docs/game-world-generation/FLOWING_WATER_CONNECTIVITY_AND_NOVELTY_SPEC.md",
  "docs/game-world-generation/CROSS_MODAL_RGB_COLLAPSE_PREVENTION_SPEC.md",
  "docs/game-world-generation/CROSS_MODAL_RGB_GATE_THRESHOLD_ALIGNMENT_20260802.md",
]

const ROOT_CLASSIFICATION = new Map([
  ["ARCHITECTURE.md", "active-reference"],
  ["BUSINESS_SPEC.md", "active-reference"],
  ["LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md", "active-subsystem-architecture"],
  ["DIRECTORY_STRUCTURE.md", "active-reference"],
  ["DOCUMENTATION_POLICY.md", "active-governance"],
  ["DOCUMENT_AUTHORITY_INDEX.md", "active-governance"],
])

const DIRECTORY_CLASSIFICATION = new Map([
  ["game-world-generation", "active-architecture"],
  ["world-visual-data-dictionary", "active-reference"],
  ["ai-painter-progress", "active-locks-or-automation-contracts"],
  ["ziwei", "separate-subsystem"],
])

const FORBIDDEN_AUTHORITY = [
  ["README.md", "当前主线：P10-B3"],
  ["docs/game-world-generation/DOCUMENT_INDEX.md", "| 代码实现 | 未开始"],
]

const FORBIDDEN_OLD_DOCUMENTS = [
  "docs/EXECUTION_PLAN.md",
  "docs/LIVE_WORLD_MVP_RULE_DICTIONARY_AND_AI_PAINTER_PLAN.md",
  "docs/PROGRESS.md",
  "docs/PROJECT_MASTER_PLAN.md",
  "docs/REFERENCE_VISUAL_BASELINE.md",
  "docs/ZIWEI_FULL_CHART_ARCHITECTURE.md",
  "docs/live-world",
]

const findings = []
const markdownFiles = walkMarkdown(DOCS_ROOT)
// `data/` contains immutable dataset-package snapshots and runtime evidence. Those
// files are intentionally historical and must never be rewritten as formal docs.
// Only human-facing directory README files participate in documentation governance.
const dataMarkdownFiles = walkMarkdown(path.join(ROOT, "data")).filter(isReadme)
const sourceMarkdownFiles = walkMarkdown(path.join(ROOT, "src")).filter(isReadme)
const allGovernedMarkdown = [
  path.join(ROOT, "README.md"),
  path.join(ROOT, "AGENTS.md"),
  ...markdownFiles,
  ...dataMarkdownFiles,
  ...sourceMarkdownFiles,
]
const packageScripts = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts ?? {}))

for (const relativePath of FORBIDDEN_OLD_DOCUMENTS) {
  if (fs.existsSync(path.join(ROOT, relativePath))) findings.push(`${relativePath}: old document must be deleted`)
}

for (const relativePath of REQUIRED_GOVERNED_DOCS) {
  const absolutePath = path.join(ROOT, relativePath)
  if (!fs.existsSync(absolutePath)) {
    findings.push(`${relativePath}: required governed document missing`)
    continue
  }
}

for (const absolutePath of allGovernedMarkdown) {
  const relativePath = normalize(path.relative(ROOT, absolutePath))
  const text = fs.readFileSync(absolutePath, "utf8")
  if (!TIMESTAMP_PATTERN.test(text)) findings.push(`${relativePath}: missing detailed Asia/Shanghai timestamp`)
  if (!STATUS_PATTERN.test(text)) findings.push(`${relativePath}: missing status field`)
  if (!text.includes(REQUIRED_SENTENCE)) findings.push(`${relativePath}: missing owner-control sentence`)
  if (relativePath.startsWith("docs/") && !classificationFor(relativePath)) findings.push(`${relativePath}: document is not covered by a governance classification`)

  for (const match of text.matchAll(/npm run ([A-Za-z0-9:_-]+)/g)) {
    if (!packageScripts.has(match[1])) findings.push(`${relativePath}: npm script does not exist: ${match[1]}`)
  }

  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, "").split("#")[0].split(/\s+"/)[0]
    if (!target || /^(https?:|mailto:|data:)/.test(target)) continue
    const resolved = path.resolve(path.dirname(absolutePath), decodeURIComponent(target))
    if (!fs.existsSync(resolved)) findings.push(`${relativePath}: broken Markdown link: ${target}`)
  }

  for (const match of text.matchAll(/docs\/[A-Za-z0-9_./-]+\.md/g)) {
    const target = match[0].replace(/[.,)`\]]+$/g, "")
    if (!fs.existsSync(path.join(ROOT, target))) findings.push(`${relativePath}: missing document reference: ${target}`)
  }
}

const modulePlanPath = "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"
const formalDocumentForbiddenPatterns = [
  [/runId\s*=/, "per-run runId evidence"],
  [/SHA-256\s*=/, "per-run SHA-256 evidence"],
  [/^#{1,6}\s+.*20\d{2}-\d{2}-\d{2}/m, "dated history heading"],
  [/^#{1,6}\s+(当前状态|当前结论|当前缺口|当前真实实现(?:矩阵)?|当前收口(?:边界)?|当前闭合状态|当前优先级|总进度表|总进度表补充|本轮.*)$/m, "runtime status or parallel plan heading"],
  [/(当前唯一下一步|当前正式下一步|当前唯一下一动作|下一步只允许|下一步只能|下一步必须|下一步不得|等待项目所有者)/, "runtime next-action authority"],
  [/^更新日期：\d{4}-\d{2}-\d{2}$/m, "duplicate short update date"],
]

for (const absolutePath of allGovernedMarkdown) {
  const relativePath = normalize(path.relative(ROOT, absolutePath))
  const text = fs.readFileSync(absolutePath, "utf8")
  const timestamps = text.match(new RegExp(TIMESTAMP_PATTERN.source, "g")) ?? []
  if (timestamps.length !== 1) findings.push(`${relativePath}: expected exactly one governance timestamp, found ${timestamps.length}`)
  if (relativePath === modulePlanPath) continue
  const statusLine = text.match(/^状态：(.+)$/m)?.[1] ?? ""
  if (statusLine.includes(" / ") || statusLine.includes("`")) {
    findings.push(`${relativePath}: formal status must be a stable single classification`)
  }
  for (const [pattern, label] of formalDocumentForbiddenPatterns) {
    if (pattern.test(text)) findings.push(`${relativePath}: formal documentation contains ${label}`)
  }
}

for (const [relativePath, forbiddenText] of FORBIDDEN_AUTHORITY) {
  const absolutePath = path.join(ROOT, relativePath)
  if (fs.existsSync(absolutePath) && fs.readFileSync(absolutePath, "utf8").includes(forbiddenText)) {
    findings.push(`${relativePath}: forbidden stale authority text: ${forbiddenText}`)
  }
}

const currentGuide = fs.readFileSync(path.join(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"), "utf8")
for (const requiredText of [
  "AI-PET-WORLD 唯一模块计划表",
  "只记录模块级目标、边界、验收条件和阶段状态",
  "表中状态不构成聊天授权",
  "平台可靠性与文档治理修复",
  "本地自研AI MVP能力迁移",
]) {
  if (!currentGuide.includes(requiredText)) findings.push(`module plan missing: ${requiredText}`)
}
const planTableCount = (currentGuide.match(/^\|---/gm) ?? []).length
if (planTableCount !== 1) findings.push(`module plan must contain exactly one table, found ${planTableCount}`)
if (/runId=|SHA-256=|当前唯一下一步|当前唯一下一动作/.test(currentGuide)) {
  findings.push("module plan contains per-run evidence or obsolete next-step wording")
}

for (const absolutePath of allGovernedMarkdown) {
  const relativePath = normalize(path.relative(ROOT, absolutePath))
  if (relativePath === modulePlanPath) continue
  const text = fs.readFileSync(absolutePath, "utf8")
  if (/当前唯一下一步|当前正式下一步|当前唯一下一动作/.test(text)) {
    findings.push(`${relativePath}: formal documentation contains runtime next-step authority`)
  }
}

for (const forbiddenParallelPlan of [
  "docs/ziwei/ROADMAP.md",
  "docs/ziwei/EXECUTION_TABLE.md",
  "docs/ziwei/DATA_DICTIONARY_COVERAGE_PLAN.md",
]) {
  if (fs.existsSync(path.join(ROOT, forbiddenParallelPlan))) findings.push(`${forbiddenParallelPlan}: parallel plan must be machine data, not formal Markdown`)
}

const gameWorldDocuments = markdownFiles
  .map((file) => normalize(path.relative(ROOT, file)))
  .filter((file) => file.startsWith("docs/game-world-generation/"))
checkExactDocumentSet("docs/game-world-generation", gameWorldDocuments, EXACT_GAME_WORLD_DOCUMENTS)

const dictionaryDocuments = markdownFiles
  .map((file) => normalize(path.relative(ROOT, file)))
  .filter((file) => file.startsWith("docs/world-visual-data-dictionary/"))
if (dictionaryDocuments.length !== 2) {
  findings.push(`docs/world-visual-data-dictionary: expected README and FULL_DICTIONARY_PRINT only, found ${dictionaryDocuments.length}`)
}
for (const forbiddenDirectory of [
  "00-master-architecture",
  "01-world-understanding",
  "02-world-director",
  "03-multiscale-visual-system",
  "04-transition-dictionary",
  "05-visual-atom-system",
  "06-professional-aesthetic-standard",
  "07-failure-experience-memory",
  "08-training-data-system",
  "09-model-architecture",
  "10-data-gap-analysis",
  "11-review-gates",
  "12-implementation-plan",
  "13-admin-console",
  "14-database-storage",
  "15-autonomous-loop",
]) {
  if (fs.existsSync(path.join(ROOT, "docs/game-world-generation", forbiddenDirectory))) {
    findings.push(`docs/game-world-generation/${forbiddenDirectory}: retired staged documentation directory must not return`)
  }
}

if (findings.length > 0) {
  console.error("Documentation policy check failed:")
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  status: "documentation_governance_check_passed",
  markdownDocuments: markdownFiles.length,
  governedDocuments: allGovernedMarkdown.length,
  requiredDocuments: REQUIRED_GOVERNED_DOCS.length,
  classifications: Object.fromEntries(DIRECTORY_CLASSIFICATION),
}, null, 2))

function walkMarkdown(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkMarkdown(absolutePath))
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolutePath)
  }
  return files
}

function classificationFor(relativePath) {
  const parts = normalize(relativePath).split("/")
  if (parts.length === 2) return ROOT_CLASSIFICATION.get(parts[1]) ?? null
  return DIRECTORY_CLASSIFICATION.get(parts[1]) ?? null
}

function normalize(value) {
  return value.replaceAll("\\", "/")
}

function isReadme(file) {
  return path.basename(file).toLowerCase() === "readme.md"
}

function checkExactDocumentSet(label, actualDocuments, expectedDocuments) {
  const actual = new Set(actualDocuments)
  const expected = new Set(expectedDocuments)
  for (const file of expected) {
    if (!actual.has(file)) findings.push(`${label}: required governed document missing from exact set: ${file}`)
  }
  for (const file of actual) {
    if (!expected.has(file)) findings.push(`${label}: unregistered Markdown document outside exact set: ${file}`)
  }
}
