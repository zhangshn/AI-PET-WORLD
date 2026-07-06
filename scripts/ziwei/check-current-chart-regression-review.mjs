import { readFileSync, readdirSync } from "node:fs"
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

const {
  getAllZiweiCurrentChartRegressionReviewProfiles,
  getZiweiCurrentChartRegressionReviewProfile,
  ZIWEI_CURRENT_CHART_REGRESSION_REVIEW_PROFILES
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const {
  buildFullZiweiChart,
  buildFullZiweiDynamicChart,
  buildZiweiInterpretation
} = require("../../src/ai/destiny-core/ziwei-core/public-api/index.ts")

const GOLDEN_SAMPLE_DIR = path.join(process.cwd(), "data", "ziwei", "golden-samples")
const REQUIRED_SECTION_TITLES = [
  "盘例定位",
  "出生资料",
  "动态时间",
  "核心预期",
  "动态宫位预期",
  "段落目标",
  "证据链断言",
  "动态层级断言",
  "隐藏规则",
  "来源边界",
  "风险复核",
  "复核清单",
  "下一步复核"
]

function fail(message) {
  console.error(`[check-current-chart-regression-review] ${message}`)
  process.exit(1)
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

function assertText(id, value, field, minLength = 12) {
  assert(typeof value === "string" && value.length >= minLength, `${id}: ${field} too short`)
}

function assertList(id, value, field, minLength, minEntryLength = 8) {
  assert(Array.isArray(value), `${id}: ${field} must be a list`)
  assert(value.length >= minLength, `${id}: ${field} needs at least ${minLength} item(s)`)
  for (const entry of value) {
    assertText(id, entry, field, minEntryLength)
  }
}

function assertContains(value, marker, id, field) {
  assert(JSON.stringify(value).includes(marker), `${id}: ${field} missing marker ${marker}`)
}

function readGoldenSamples() {
  return readdirSync(GOLDEN_SAMPLE_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      return JSON.parse(readFileSync(path.join(GOLDEN_SAMPLE_DIR, file), "utf8"))
    })
}

function dynamicFlowPalaces(dynamicChart) {
  return Object.fromEntries(dynamicChart.flows.map((flow) => [flow.type, flow.palace]))
}

const profiles = getAllZiweiCurrentChartRegressionReviewProfiles()
assert(
  profiles === ZIWEI_CURRENT_CHART_REGRESSION_REVIEW_PROFILES,
  "getter must return the exported regression registry"
)

const goldenSamples = readGoldenSamples()
assert(profiles.length === goldenSamples.length, `expected ${goldenSamples.length} profiles, got ${profiles.length}`)

const profileById = new Map(profiles.map((profile) => [profile.sampleId, profile]))

for (const golden of goldenSamples) {
  const profile = profileById.get(golden.sampleId)
  assert(profile, `missing regression profile for golden sample ${golden.sampleId}`)
  assert(getZiweiCurrentChartRegressionReviewProfile(golden.sampleId)?.sampleId === golden.sampleId, `${golden.sampleId}: getter mismatch`)

  const id = profile.sampleId
  assertText(id, profile.title, "title", 8)
  assertText(id, profile.birthSummary, "birthSummary", 20)
  assertText(id, profile.dynamicSummary, "dynamicSummary", 20)
  assertText(id, profile.regressionPurpose, "regressionPurpose", 20)
  assertList(id, profile.paragraphTargets, "paragraphTargets", 5)
  assertList(id, profile.evidenceChainAssertions, "evidenceChainAssertions", 5)
  assertList(id, profile.dynamicLayerAssertions, "dynamicLayerAssertions", 4)
  assertList(id, profile.hiddenOutputRules, "hiddenOutputRules", 5)
  assertList(id, profile.sourceBoundary, "sourceBoundary", 4)
  assertList(id, profile.riskReviewRules, "riskReviewRules", 4)
  assertList(id, profile.reviewChecklist, "reviewChecklist", 5)
  assertText(id, profile.nextReviewAction, "nextReviewAction", 24)
  assert(profile.sections.length === REQUIRED_SECTION_TITLES.length, `${id}: section count mismatch`)

  const sectionTitles = profile.sections.map((section) => section.title)
  assert(
    JSON.stringify(sectionTitles) === JSON.stringify(REQUIRED_SECTION_TITLES),
    `${id}: section titles mismatch`
  )

  assert(profile.expectedCore.lifePalace === golden.expected.lifePalace, `${id}: lifePalace expectation mismatch`)
  assert(profile.expectedCore.bodyPalace === golden.expected.bodyPalace, `${id}: bodyPalace expectation mismatch`)
  assert(profile.expectedCore.elementGate === golden.expected.elementGate, `${id}: elementGate expectation mismatch`)
  assert(profile.expectedCore.totalStarCount === golden.expected.totalStarCount, `${id}: totalStarCount expectation mismatch`)
  assert(profile.expectedCore.direction === golden.expected.dynamicDebug.direction, `${id}: direction expectation mismatch`)
  assert(profile.expectedCore.startAge === golden.expected.dynamicDebug.startAge, `${id}: startAge expectation mismatch`)
  assert(profile.expectedCore.isDaYunStarted === golden.expected.dynamicDebug.isDaYunStarted, `${id}: isDaYunStarted expectation mismatch`)
  assert(
    JSON.stringify(profile.expectedDynamicPalaces) === JSON.stringify(golden.expected.dynamicFlowPalaces),
    `${id}: dynamic palace expectation mismatch`
  )

  assertContains(profile, "当前盘", id, "profile")
  assertContains(profile, "证据链", id, "profile")
  assertContains(profile, "动态", id, "profile")
  assertContains(profile, "大限", id, "profile")
  assertContains(profile, "流年", id, "profile")
  assertContains(profile, "流月", id, "profile")
  assertContains(profile, "流日", id, "profile")
  assertContains(profile, "流时", id, "profile")
  assertContains(profile, "隐藏", id, "profile")
  assertContains(profile, "不复制", id, "profile")
  assertContains(profile, "不做人格化", id, "profile")

  const chart = buildFullZiweiChart({
    ...golden.birthInput,
    timezone: "Asia/Shanghai"
  })
  const dynamicChart = buildFullZiweiDynamicChart({
    chart,
    input: golden.dynamicInput
  })
  const interpretation = buildZiweiInterpretation({ chart, dynamicChart })
  const chains = interpretation.detailedAnalysis.currentEvidenceChains

  assert(chart.palaces.length === golden.expected.palaceCount, `${id}: palace count mismatch`)
  assert(chart.summary.lifePalace === profile.expectedCore.lifePalace, `${id}: built lifePalace mismatch`)
  assert(chart.summary.bodyPalace === profile.expectedCore.bodyPalace, `${id}: built bodyPalace mismatch`)
  assert(chart.summary.elementGate === profile.expectedCore.elementGate, `${id}: built elementGate mismatch`)
  assert(chart.summary.totalStarCount === profile.expectedCore.totalStarCount, `${id}: built totalStarCount mismatch`)
  assert(dynamicChart.debug.direction === profile.expectedCore.direction, `${id}: built direction mismatch`)
  assert(dynamicChart.debug.startAge === profile.expectedCore.startAge, `${id}: built startAge mismatch`)
  assert(dynamicChart.debug.isDaYunStarted === profile.expectedCore.isDaYunStarted, `${id}: built isDaYunStarted mismatch`)
  assert(
    JSON.stringify(dynamicFlowPalaces(dynamicChart)) === JSON.stringify(profile.expectedDynamicPalaces),
    `${id}: built dynamic flow palace mismatch`
  )
  assert(chains.length >= 60, `${id}: expected at least 60 current evidence chains, got ${chains.length}`)
  assert(chains.some((chain) => chain.kind === "pattern-boundary"), `${id}: missing pattern boundary chain`)
  assert(chains.some((chain) => chain.kind === "dynamic-flow"), `${id}: missing dynamic flow chain`)
  assert(
    interpretation.detailedAnalysis.evidenceSummaryLines.length >= 4,
    `${id}: expected evidence summary lines`
  )
}

assertContains(profiles, "亥时边界", "profiles", "profiles")
assertContains(profiles, "子时边界", "profiles", "profiles")
assertContains(profiles, "阳男顺行", "profiles", "profiles")
assertContains(profiles, "阳女逆行", "profiles", "profiles")
assertContains(profiles, "阴女顺行", "profiles", "profiles")
assertContains(profiles, "阴男逆行", "profiles", "profiles")
assertContains(profiles, "未起运", "profiles", "profiles")

console.log(`[check-current-chart-regression-review] ok profiles=${profiles.length}`)
