import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
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
  getAllZiweiCurrentChartOutputClosureGateProfiles,
  getZiweiCurrentChartOutputClosureGateProfile,
  ZIWEI_CURRENT_CHART_OUTPUT_CLOSURE_GATE_PROFILES
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")

const REQUIRED_GATE_IDS = [
  "current-output.natal-palace-core",
  "current-output.star-body",
  "current-output.star-combination",
  "current-output.transformation-source",
  "current-output.pattern-hit",
  "current-output.dynamic-layer",
  "current-output.risk-topic",
  "current-output.source-boundary"
]

const REQUIRED_SECTION_TITLES = [
  "门禁定位",
  "准入条件",
  "必需证据字段",
  "当前盘输出规则",
  "总字典保留规则",
  "隐藏规则",
  "复核触发",
  "降权规则",
  "禁止输出",
  "来源边界",
  "校验清单",
  "下一步动作"
]

const REQUIRED_DECISIONS = [
  "allow-current-output",
  "dictionary-only",
  "review-required",
  "prohibited"
]

function fail(message) {
  console.error(`[check-current-chart-output-closure-gate] ${message}`)
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

const profiles = getAllZiweiCurrentChartOutputClosureGateProfiles()
assert(
  profiles === ZIWEI_CURRENT_CHART_OUTPUT_CLOSURE_GATE_PROFILES,
  "getter must return the exported closure gate registry"
)
assert(profiles.length === REQUIRED_GATE_IDS.length, `expected 8 gates, got ${profiles.length}`)

const actualGateIds = profiles.map((profile) => profile.gateId)
assert(
  JSON.stringify(actualGateIds) === JSON.stringify(REQUIRED_GATE_IDS),
  `gate id order mismatch: ${actualGateIds.join(", ")}`
)

const decisionSet = new Set(profiles.map((profile) => profile.decision))
for (const decision of REQUIRED_DECISIONS) {
  assert(decisionSet.has(decision), `missing decision ${decision}`)
}

for (const profile of profiles) {
  const id = profile.gateId
  assert(getZiweiCurrentChartOutputClosureGateProfile(id)?.gateId === id, `${id}: getter mismatch`)
  assertText(id, profile.label, "label", 4)
  assertText(id, profile.purpose, "purpose", 24)
  assertList(id, profile.admissionConditions, "admissionConditions", 4)
  assertList(id, profile.requiredEvidenceFields, "requiredEvidenceFields", 4)
  assertList(id, profile.outputRules, "outputRules", 4)
  assertList(id, profile.dictionaryOnlyRules, "dictionaryOnlyRules", 3)
  assertList(id, profile.hideRules, "hideRules", 3)
  assertList(id, profile.reviewTriggers, "reviewTriggers", 3)
  assertList(id, profile.downgradeRules, "downgradeRules", 3)
  assertList(id, profile.prohibitedOutputs, "prohibitedOutputs", 5)
  assertList(id, profile.sourceBoundary, "sourceBoundary", 4)
  assertList(id, profile.validationChecklist, "validationChecklist", 5)
  assertText(id, profile.nextAction, "nextAction", 24)
  assert(profile.sections.length === REQUIRED_SECTION_TITLES.length, `${id}: section count mismatch`)

  const sectionTitles = profile.sections.map((section) => section.title)
  assert(
    JSON.stringify(sectionTitles) === JSON.stringify(REQUIRED_SECTION_TITLES),
    `${id}: section title mismatch`
  )
  for (const section of profile.sections) {
    assertList(id, section.items, `section.${section.title}`, 1)
  }

  assertContains(profile, "当前盘", id, "profile")
  assertContains(profile, "总字典", id, "profile")
  assertContains(profile, "隐藏", id, "profile")
  assertContains(profile, "复核", id, "profile")
  assertContains(profile, "禁止", id, "profile")
  assertContains(profile, "不复制", id, "profile")
  assertContains(profile, "不做人格化", id, "profile")
}

assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.natal-palace-core"), "三方四正", "natal-palace-core", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.star-body"), "庙旺落陷", "star-body", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.star-combination"), "同宫", "star-combination", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.star-combination"), "会照", "star-combination", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.transformation-source"), "谁的四化", "transformation-source", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.transformation-source"), "禁止给四化本身标庙旺落陷", "transformation-source", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.pattern-hit"), "patternId", "pattern-hit", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.pattern-hit"), "matchedPalaces", "pattern-hit", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.dynamic-layer"), "大限", "dynamic-layer", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.dynamic-layer"), "流年", "dynamic-layer", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.dynamic-layer"), "流月", "dynamic-layer", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.risk-topic"), "不做医学诊断", "risk-topic", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.source-boundary"), "现代网站", "source-boundary", "profile")
assertContains(getZiweiCurrentChartOutputClosureGateProfile("current-output.source-boundary"), "现代书籍", "source-boundary", "profile")

console.log(`[check-current-chart-output-closure-gate] ok gates=${profiles.length}`)
