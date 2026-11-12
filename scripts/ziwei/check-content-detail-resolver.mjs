import { createZiweiCheckRequire } from "../lib/ziwei-check-module-loader.mjs"

const require = createZiweiCheckRequire(import.meta.url)

const {
  buildZiweiChartInterpretation,
  getMainStarContentDetail,
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

for (const starId of Object.values(MAIN_STAR_IDS)) {
  const canonical = getMainStarContentDetail(starId)
  const resolved = getStarContentDetail(starId)
  const generic = resolveZiweiContentDetail({ kind: "star", starId })
  if (!canonical || resolved !== canonical || resolved.starId !== starId) {
    fail(`expected star resolver to preserve canonical dictionary identity: ${starId}`)
  }
  if (generic?.kind !== "star" || generic.detail !== canonical) {
    fail(`expected generic resolver to preserve canonical star detail: ${starId}`)
  }
  if (typeof resolved.worldBehaviorHint !== "string" || !resolved.worldBehaviorHint.trim()) {
    fail(`expected nonempty canonical interpretation hint: ${starId}`)
  }
}

if (
  getStarContentDetail("star.unknown-check-fixture") !== null ||
  resolveZiweiContentDetail({ kind: "star", starId: "star.unknown-check-fixture" }) !== null
) {
  fail("unknown star identity must not resolve to an invented dictionary entry")
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
