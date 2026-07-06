import { existsSync, readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
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

const root = process.cwd()
const expectedStages = [
  "P24",
  "P25",
  "P26",
  "P27",
  "P28",
  "P29",
  "P30",
  "P31",
  "P32",
  "P33",
  "P34"
]
const expectedDocs = [
  "ALGORITHM_CONTRACTS.md",
  "CONTENT_DATA_DICTIONARY.md",
  "DATA_DICTIONARY_ANALYSIS_FLOW.md",
  "DATA_DICTIONARY_ARCHITECTURE.md",
  "DATA_DICTIONARY_COVERAGE_PLAN.md",
  "DATA_DICTIONARY_CURRENT_CHART_OUTPUT_CLOSURE_GATE.md",
  "DATA_DICTIONARY_CURRENT_CHART_PARAGRAPH_SAMPLE_REVIEW.md",
  "DATA_DICTIONARY_CURRENT_CHART_REGRESSION_REVIEW.md",
  "DATA_DICTIONARY_EXPLANATION_REFERENCE_METHOD.md",
  "DATA_DICTIONARY_FIELDS.md",
  "DATA_DICTIONARY_GAP_REVIEW.md",
  "DATA_DICTIONARY_MASTER_BLUEPRINT.md",
  "DATA_DICTIONARY_PATTERN_READABILITY_REVIEW.md",
  "DATA_DICTIONARY_STAR_PALACE_READABILITY_REVIEW.md",
  "DATA_DICTIONARY_STAR_SAMPLE_REVIEW.md",
  "DATA_DICTIONARY_TRANSFORMATION_BRANCH_DEPTH.md",
  "DIRECTORY_STRUCTURE.md",
  "EXECUTION_TABLE.md",
  "PAGE_ACCEPTANCE.md",
  "README.md",
  "ROADMAP.md",
  "SOURCE_STORAGE_BOUNDARY.md"
]

const {
  getAllZiweiContentExpansionClosureRecords,
  getAllZiweiContentExpansionPriorityItems
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

function fail(message) {
  console.error(`[check-p24-p34-closure] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function readWorkspaceFile(relativePath) {
  const absolutePath = path.join(root, relativePath)
  assert(existsSync(absolutePath), `missing workspace file: ${relativePath}`)
  return readFileSync(absolutePath, "utf8")
}

function assertContains(content, marker, label) {
  assert(content.includes(marker), `${label} missing marker: ${marker}`)
}

const closureRecords = getAllZiweiContentExpansionClosureRecords()
const queueItems = getAllZiweiContentExpansionPriorityItems()
const queueIds = new Set(queueItems.map((item) => item.itemId))

assert(closureRecords.length === expectedStages.length, `closure record count mismatch: ${closureRecords.length}`)

const closureByStage = new Map(closureRecords.map((record) => [record.stage, record]))
for (const stage of expectedStages) {
  const record = closureByStage.get(stage)
  assert(record, `missing closure record: ${stage}`)
  assert(record.status === "completed", `${stage} must be completed`)
  assert(record.completedScope.length >= 3, `${stage} completedScope must contain at least 3 items`)
  assert(record.acceptanceEvidence.length >= 3, `${stage} acceptanceEvidence must contain at least 3 items`)
  assert(record.sourceBoundary.length >= 2, `${stage} sourceBoundary must contain at least 2 items`)
  assert(record.remainingBoundary.length >= 2, `${stage} remainingBoundary must contain at least 2 items`)
  assert(record.validationCommands.length >= 1, `${stage} validationCommands must not be empty`)
  for (const queueId of record.relatedQueueItemIds) {
    assert(queueIds.has(queueId), `${stage} references unknown queue item: ${queueId}`)
  }
}

const actualDocs = readdirSync(path.join(root, "docs/ziwei"))
  .filter((name) => name.endsWith(".md"))
  .sort()
assert(
  actualDocs.join("|") === expectedDocs.join("|"),
  `docs/ziwei file list mismatch: ${actualDocs.join(", ")}`
)

const executionTable = readWorkspaceFile("docs/ziwei/EXECUTION_TABLE.md")
for (const stage of expectedStages) {
  assertContains(executionTable, `| ${stage} |`, "docs/ziwei/EXECUTION_TABLE.md")
}
assertContains(executionTable, "| P35-A | 全网资料采集入口设计 | 已完成 |", "docs/ziwei/EXECUTION_TABLE.md")
assertContains(executionTable, "| P35-B | 来源元信息与可存储边界分级 | 已完成 |", "docs/ziwei/EXECUTION_TABLE.md")
assertContains(executionTable, "| P35-C | 资料清洗、去重、归类 | 已完成 |", "docs/ziwei/EXECUTION_TABLE.md")
assertContains(executionTable, "| P35-D | 星曜宫位格局四化主题映射 | 已完成 |", "docs/ziwei/EXECUTION_TABLE.md")
assertContains(executionTable, "| P35-E | 可用资料筛选与入库 | 已完成 |", "docs/ziwei/EXECUTION_TABLE.md")
assertContains(executionTable, "| P35-F | 分析模型与页面使用接入 | 已完成 |", "docs/ziwei/EXECUTION_TABLE.md")
assertContains(executionTable, "| P36-0 | 数据字典总规划重整 | 已完成 |", "docs/ziwei/EXECUTION_TABLE.md")
assertContains(executionTable, "| P36-A | 真实资料来源登记与索引扩充 | 进行中 |", "docs/ziwei/EXECUTION_TABLE.md")
assertContains(executionTable, "| P36-F | P0 | 当前盘综合解释资料化 |", "docs/ziwei/EXECUTION_TABLE.md")

const roadmap = readWorkspaceFile("docs/ziwei/ROADMAP.md")
for (const stage of expectedStages) {
  assertContains(roadmap, `| ${stage} |`, "docs/ziwei/ROADMAP.md")
}
assertContains(roadmap, "P24-P34 已闭合", "docs/ziwei/ROADMAP.md")

const readme = readWorkspaceFile("docs/ziwei/README.md")
assertContains(readme, "P24-P34 当前阶段闭合", "docs/ziwei/README.md")
assertContains(readme, "行为映射 | 暂停", "docs/ziwei/README.md")

const dictionary = readWorkspaceFile("docs/ziwei/CONTENT_DATA_DICTIONARY.md")
for (const stage of expectedStages) {
  assertContains(dictionary, stage, "docs/ziwei/CONTENT_DATA_DICTIONARY.md")
}
assertContains(dictionary, "P36 数据字典重整", "docs/ziwei/CONTENT_DATA_DICTIONARY.md")
assertContains(dictionary, "DATA_DICTIONARY_ARCHITECTURE.md", "docs/ziwei/CONTENT_DATA_DICTIONARY.md")

const dictionaryArchitecture = readWorkspaceFile("docs/ziwei/DATA_DICTIONARY_ARCHITECTURE.md")
assertContains(dictionaryArchitecture, "紫微斗数数据字典", "docs/ziwei/DATA_DICTIONARY_ARCHITECTURE.md")
assertContains(dictionaryArchitecture, "当前盘调用层", "docs/ziwei/DATA_DICTIONARY_ARCHITECTURE.md")

const dictionaryFields = readWorkspaceFile("docs/ziwei/DATA_DICTIONARY_FIELDS.md")
assertContains(dictionaryFields, "星曜入宫字段", "docs/ziwei/DATA_DICTIONARY_FIELDS.md")
assertContains(dictionaryFields, "当前盘输出字段", "docs/ziwei/DATA_DICTIONARY_FIELDS.md")

const dictionaryCoverage = readWorkspaceFile("docs/ziwei/DATA_DICTIONARY_COVERAGE_PLAN.md")
assertContains(dictionaryCoverage, "P36-0", "docs/ziwei/DATA_DICTIONARY_COVERAGE_PLAN.md")
assertContains(dictionaryCoverage, "星曜入十二宫解释深挖", "docs/ziwei/DATA_DICTIONARY_COVERAGE_PLAN.md")

const dictionaryFlow = readWorkspaceFile("docs/ziwei/DATA_DICTIONARY_ANALYSIS_FLOW.md")
assertContains(dictionaryFlow, "读盘调用链", "docs/ziwei/DATA_DICTIONARY_ANALYSIS_FLOW.md")
assertContains(dictionaryFlow, "当前盘解释", "docs/ziwei/DATA_DICTIONARY_ANALYSIS_FLOW.md")

const algorithmContracts = readWorkspaceFile("docs/ziwei/ALGORITHM_CONTRACTS.md")
assertContains(
  algorithmContracts,
  "check-p24-p34-closure.mjs",
  "docs/ziwei/ALGORITHM_CONTRACTS.md"
)

const sourceCopyright = readWorkspaceFile("docs/ziwei/SOURCE_STORAGE_BOUNDARY.md")
assertContains(sourceCopyright, "现代资料只存元信息", "docs/ziwei/SOURCE_STORAGE_BOUNDARY.md")
assertContains(sourceCopyright, "现代资料不得复制", "docs/ziwei/SOURCE_STORAGE_BOUNDARY.md")

console.log(
  [
    "[check-p24-p34-closure] passed",
    `closureRecords=${closureRecords.length}`,
    `queueItems=${queueItems.length}`,
    `docs=${actualDocs.length}`
  ].join(" ")
)
