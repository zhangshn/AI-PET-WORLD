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
  buildFullZiweiChart,
  buildZiweiInterpretation,
  buildZiweiPageViewModel
} = require("../../src/ai/destiny-core/ziwei-core/public-api/index.ts")
const {
  getAllZiweiStarInterpretationProfiles,
  SECTOR_INTERPRETATION_PROFILES
} = require("../../src/ai/destiny-core/ziwei-core/interpretation/index.ts")
const {
  ziweiStarCatalog
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog/index.ts")

function fail(message) {
  console.error(`Ziwei interpretation check failed: ${message}`)
  process.exit(1)
}

const chart = buildFullZiweiChart({
  calendarType: "solar",
  year: 1990,
  month: 5,
  day: 17,
  hour: 9,
  gender: "male"
})
const interpretation = buildZiweiInterpretation({
  chart
})
const viewModel = buildZiweiPageViewModel({
  chart
})
const starProfiles = getAllZiweiStarInterpretationProfiles()

if (interpretation.chartHighlights.length !== 3) {
  fail("expected 3 chart highlights")
}

if (interpretation.palaceInterpretations.length !== 12) {
  fail("expected 12 palace interpretations")
}

const lifePalace = interpretation.palaceInterpretations.find((palace) => {
  return palace.branch === chart.summary.lifePalace
})

if (!lifePalace || lifePalace.items.length === 0) {
  fail("expected life palace to have interpretation items")
}

if (
  !lifePalace.items.some((item) => {
    return item.sourceRuleIds.length > 0
  })
) {
  fail("expected palace interpretation items to keep source rule ids")
}

if (viewModel.interpretation.palaceInterpretations.length !== 12) {
  fail("expected page view model to include interpretation palaces")
}

if (viewModel.interpretation.debug.totalItems !== interpretation.debug.totalItems) {
  fail("expected page view model interpretation to match direct builder")
}

if (starProfiles.length !== ziweiStarCatalog.length) {
  fail("expected every catalog star to have an interpretation profile")
}

if (
  starProfiles.some((profile) => {
    return !profile.summary || profile.tags.length === 0
  })
) {
  fail("expected every star interpretation profile to include summary and tags")
}

if (
  !lifePalace.items.some((item) => {
    return item.scope === "star"
  })
) {
  fail("expected palace interpretation to include star-level items")
}

if (Object.keys(SECTOR_INTERPRETATION_PROFILES).length !== 12) {
  fail("expected 12 sector interpretation profiles")
}

if (
  !lifePalace.items.some((item) => {
    return item.scope === "combination" && item.sourceRuleIds.length > 0
  })
) {
  fail("expected palace interpretation to include sourced combination items")
}

if (
  interpretation.palaceInterpretations.some((palace) => {
    return !palace.items.some((item) => item.scope === "relation")
  })
) {
  fail("expected every palace interpretation to include a relation item")
}

const lifeRelationItem = lifePalace.items.find((item) => {
  return item.scope === "relation"
})

if (!lifeRelationItem?.summary.includes("三方四正范围")) {
  fail("expected relation item to summarize trine and opposite scope")
}

if (!lifeRelationItem.sourceRuleIds.length) {
  fail("expected relation item to keep source rule ids")
}

const transformationItems = interpretation.palaceInterpretations.flatMap((palace) => {
  return palace.items.filter((item) => {
    return item.scope === "dynamic" && item.category === "transformation"
  })
})

if (transformationItems.length < 4) {
  fail("expected transformation interpretation items")
}

if (
  !transformationItems.some((item) => {
    return item.title.includes("作用") && item.sourceRuleIds.length > 0
  })
) {
  fail("expected transformation items to include target star and rule source")
}

if (interpretation.contentDetails.starInsights.length < 40) {
  fail("expected interpretation to include content detail star insights")
}

if (
  interpretation.contentDetails.personalityTendencies.length === 0 ||
  interpretation.contentDetails.worldBehaviorHints.length === 0
) {
  fail("expected interpretation to aggregate personality and world behavior hints")
}

if (interpretation.detailedAnalysis.palaceAnalyses.length !== 12) {
  fail("expected interpretation to include 12 detailed palace analyses")
}

if (interpretation.detailedAnalysis.debug.analyzedStarCount < 40) {
  fail("expected detailed analysis to cover supported chart stars")
}

console.log("Ziwei interpretation check passed.")
