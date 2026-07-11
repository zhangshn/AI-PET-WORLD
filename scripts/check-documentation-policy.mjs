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
  "docs/DIRECTORY_STRUCTURE.md",
  "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md",
  "docs/game-world-generation/README.md",
  "docs/game-world-generation/DOCUMENT_INDEX.md",
  "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
  "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
  "docs/world-visual-data-dictionary/README.md",
  "docs/ai-painter-progress/README.md",
  "docs/ai-painter-progress/GENERATED_RESULTS_PAGE_LOCKED_SPEC.md",
  "docs/ai-painter-progress/TRAINING_DATA_PERSISTENCE_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AI_MODEL_TRAINING_ARCHITECTURE_ALIGNMENT.md",
  "docs/ai-painter-progress/AI_PAINTER_CONSOLE_PAGE_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AI_PAINTER_ADMIN_BACKEND_LOCKED_SPEC.md",
  "docs/ai-painter-progress/AUTO_REPAIR_PLAN_RUNNER_LOCKED_SPEC.md",
  "docs/ziwei/README.md",
]

const ROOT_CLASSIFICATION = new Map([
  ["ARCHITECTURE.md", "active-reference"],
  ["BUSINESS_SPEC.md", "active-reference"],
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
  const text = fs.readFileSync(absolutePath, "utf8")
  if (!TIMESTAMP_PATTERN.test(text)) findings.push(`${relativePath}: missing detailed Asia/Shanghai timestamp`)
  if (!STATUS_PATTERN.test(text)) findings.push(`${relativePath}: missing status field`)
  if (!text.includes(REQUIRED_SENTENCE)) findings.push(`${relativePath}: missing owner-control sentence`)
}

for (const absolutePath of markdownFiles) {
  const relativePath = normalize(path.relative(ROOT, absolutePath))
  const text = fs.readFileSync(absolutePath, "utf8")
  if (!classificationFor(relativePath)) findings.push(`${relativePath}: document is not covered by a governance classification`)

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

for (const [relativePath, forbiddenText] of FORBIDDEN_AUTHORITY) {
  const absolutePath = path.join(ROOT, relativePath)
  if (fs.existsSync(absolutePath) && fs.readFileSync(absolutePath, "utf8").includes(forbiddenText)) {
    findings.push(`${relativePath}: forbidden stale authority text: ${forbiddenText}`)
  }
}

const allDocumentText = markdownFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n")
if (/RUNTIME_STATUS_HEARTBEAT_SPEC|心跳|heartbeat/i.test(allDocumentText)) {
  findings.push("docs: legacy realtime-status terminology remains")
}

const gameWorldDocumentText = markdownFiles
  .filter((file) => normalize(path.relative(DOCS_ROOT, file)).startsWith("game-world-generation/"))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n")
if (/documentation-only|未进入代码实现/.test(gameWorldDocumentText)) {
  findings.push("docs/game-world-generation: stale implementation status remains")
}

const currentGuide = fs.readFileSync(path.join(ROOT, "docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md"), "utf8")
for (const requiredText of [
  "本文档是当前继续工作的唯一执行入口",
  "npm run run:complete-game-world",
  "owner_review_rejected",
  "data_gap_insufficient",
]) {
  if (!currentGuide.includes(requiredText)) findings.push(`current execution guide missing: ${requiredText}`)
}

const gameWorldDocuments = markdownFiles
  .map((file) => normalize(path.relative(ROOT, file)))
  .filter((file) => file.startsWith("docs/game-world-generation/"))
if (gameWorldDocuments.length !== 6) {
  findings.push(`docs/game-world-generation: expected exactly 6 governed documents, found ${gameWorldDocuments.length}`)
}

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
  governedDocuments: REQUIRED_GOVERNED_DOCS.length,
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
