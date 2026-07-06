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
  buildZiweiChartInterpretation,
  getStarContentDetail,
  resolveZiweiContentDetail
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  buildFullZiweiChart
} = require("../../src/ai/destiny-core/ziwei-core/public-api/build-full-ziwei-chart.ts")
const {
  MAIN_STAR_IDS,
  TRANSFORMATION_STAR_IDS
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")

function fail(message) {
  console.error(`[check-content-detail-resolver] ${message}`)
  process.exit(1)
}

const starDetail = getStarContentDetail(MAIN_STAR_IDS.ziwei)

if (!starDetail?.worldBehaviorHint.includes("管家")) {
  fail("expected star resolver to return butler world behavior hint")
}

const transformationDetail = resolveZiweiContentDetail({
  kind: "star",
  starId: TRANSFORMATION_STAR_IDS.huaji
})

if (transformationDetail?.kind !== "star") {
  fail("expected generic resolver to resolve transformation star detail")
}

const patternDetail = resolveZiweiContentDetail({
  kind: "pattern",
  pattern: {
    id: "pattern.adverse.lu-ji-same-palace",
    label: "禄忌同宫格",
    category: "adverse",
    conditionText: "化禄、化忌同落一宫。"
  }
})

if (patternDetail?.kind !== "pattern" || patternDetail.detail.tone !== "adverse") {
  fail("expected generic resolver to resolve adverse pattern detail")
}

const chart = buildFullZiweiChart({
  calendarType: "solar",
  year: 1990,
  month: 5,
  day: 17,
  hour: 9,
  gender: "female",
  timezone: "Asia/Shanghai"
})
const interpretation = buildZiweiChartInterpretation({ chart })

if (interpretation.contentDetails.starInsights.length < 40) {
  fail("expected chart interpretation to include star content detail insights")
}

if (
  interpretation.contentDetails.personalityTendencies.length === 0 ||
  interpretation.contentDetails.worldBehaviorHints.length === 0
) {
  fail("expected chart interpretation to aggregate personality and world behavior hints")
}

if (
  !interpretation.contentDetails.debug.supportedCategories.includes("transformation")
) {
  fail("expected content detail summary to list transformation as supported category")
}

console.log(
  `[check-content-detail-resolver] ok (${interpretation.contentDetails.starInsights.length} star insight(s))`
)
