import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript"

const require = createRequire(import.meta.url)
const root = process.cwd()

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText

  module._compile(output, filename)
}

const contractPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "contracts",
  "placement-contract.ts",
)
const pageContractPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "contracts",
  "page-view-contract.ts",
)
const brightnessPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "star-catalog",
  "star-brightness.ts",
)
const fullChartEnginePath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "full-chart",
  "full-chart-engine.ts",
)
const starGroupListPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-group-list.tsx",
)
const starCatalogTablePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-catalog-table.tsx",
)
const pageDocPath = path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md")
const executionTablePath = path.join(root, "data", "ziwei", "legacy-execution-verification-baseline-v1.txt")

function fail(message) {
  console.error(`Ziwei star brightness check failed: ${message}`)
  process.exit(1)
}

const requiredFiles = [
  contractPath,
  pageContractPath,
  brightnessPath,
  fullChartEnginePath,
  starGroupListPath,
  starCatalogTablePath,
  pageDocPath,
  executionTablePath,
]

requiredFiles.forEach((filePath) => {
  if (!existsSync(filePath)) {
    fail(`${path.relative(root, filePath)} is missing`)
  }
})

const contractText = readFileSync(contractPath, "utf8")
const pageContractText = readFileSync(pageContractPath, "utf8")
const brightnessText = readFileSync(brightnessPath, "utf8")
const fullChartEngineText = readFileSync(fullChartEnginePath, "utf8")
const starGroupListText = readFileSync(starGroupListPath, "utf8")
const starCatalogTableText = readFileSync(starCatalogTablePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const executionTableText = readFileSync(executionTablePath, "utf8")

const staticMarkers = [
  [contractText, "ZiweiStarBrightnessLevel"],
  [contractText, '"bu"'],
  [contractText, "ZiweiStarBrightness"],
  [contractText, "brightness?: ZiweiStarBrightness"],
  [pageContractText, "brightness?: ZiweiStarBrightness"],
  [brightnessText, "MAIN_STAR_BRIGHTNESS_TABLE"],
  [brightnessText, "ASSISTANT_STAR_BRIGHTNESS_TABLE"],
  [brightnessText, "MALEFIC_STAR_BRIGHTNESS_TABLE"],
  [brightnessText, "ZIWEI_STAR_BRIGHTNESS_TABLE"],
  [brightnessText, "resolveZiweiStarBrightness"],
  [brightnessText, "applyZiweiStarBrightness"],
  [brightnessText, "brightness.assistant-stars.by-branch"],
  [brightnessText, "brightness.malefic-stars.by-branch"],
  [brightnessText, "brightness.no-fixed-table"],
  [brightnessText, 'star.category === "transformation"'],
  [fullChartEngineText, "applyZiweiStarBrightness"],
  [starGroupListText, "庙旺落陷"],
  [starGroupListText, "四化来源"],
  [starGroupListText, "被化星曜"],
  [starGroupListText, "formatBrightnessLabel"],
  [starCatalogTableText, "庙旺"],
  [starCatalogTableText, "不参与"],
  [pageDocText, "庙旺落陷"],
  [executionTableText, "星曜庙旺落陷字段与主星亮度表"],
  [executionTableText, "辅曜煞曜庙旺落陷分表"],
]

staticMarkers.forEach(([text, marker]) => {
  if (!text.includes(marker)) {
    fail(`missing marker: ${marker}`)
  }
})

const {
  ASSISTANT_STAR_BRIGHTNESS_TABLE,
  ASSISTANT_STAR_IDS,
  MAIN_STAR_BRIGHTNESS_TABLE,
  MAIN_STAR_IDS,
  MALEFIC_STAR_BRIGHTNESS_TABLE,
  MALEFIC_STAR_IDS
} = require("../../src/ai/destiny-core/ziwei-core/star-catalog")
const {
  buildFullZiweiChart,
  buildZiweiPageViewModel
} = require("../../src/ai/destiny-core/ziwei-core/public-api")

const branches = [
  "yin",
  "mao",
  "chen",
  "si",
  "wu",
  "wei",
  "shen",
  "you",
  "xu",
  "hai",
  "zi",
  "chou",
]
const validLevels = new Set(["miao", "wang", "de", "li", "ping", "bu", "xian"])

Object.values(MAIN_STAR_IDS).forEach((starId) => {
  const table = MAIN_STAR_BRIGHTNESS_TABLE[starId]

  if (!table) {
    fail(`main star brightness table is missing: ${starId}`)
  }

  branches.forEach((branch) => {
    const level = table[branch]

    if (!validLevels.has(level)) {
      fail(`invalid brightness level for ${starId} at ${branch}: ${level}`)
    }
  })
})

const assistantStarsWithBrightness = [
  ASSISTANT_STAR_IDS.wenchang,
  ASSISTANT_STAR_IDS.wenqu,
]
const maleficStarsWithBrightness = [
  MALEFIC_STAR_IDS.huoxing,
  MALEFIC_STAR_IDS.lingxing,
  MALEFIC_STAR_IDS.qingyang,
  MALEFIC_STAR_IDS.tuoluo,
]

assertBrightnessTableCoverage(
  "assistant star",
  ASSISTANT_STAR_BRIGHTNESS_TABLE,
  assistantStarsWithBrightness
)
assertBrightnessTableCoverage(
  "malefic star",
  MALEFIC_STAR_BRIGHTNESS_TABLE,
  maleficStarsWithBrightness
)

const chart = buildFullZiweiChart({
  calendarType: "solar",
  year: 1990,
  month: 5,
  day: 17,
  hour: 9,
  gender: "male"
})
const viewModel = buildZiweiPageViewModel({ chart })
const chartStars = chart.palaces.flatMap((palace) => {
  return Object.values(palace.stars).flat()
})
const mainStarIds = new Set(Object.values(MAIN_STAR_IDS))
const assistantStarIdsWithBrightness = new Set(assistantStarsWithBrightness)
const maleficStarIdsWithBrightness = new Set(maleficStarsWithBrightness)

if (chartStars.length !== 103) {
  fail(`expected 103 stars, got ${chartStars.length}`)
}

chartStars.forEach((star) => {
  if (star.category === "transformation") {
    if (star.brightness) {
      fail(`transformation star must not carry brightness: ${star.starId}`)
    }

    return
  }

  if (!star.brightness) {
    fail(`chart star is missing brightness: ${star.starId}`)
  }

  if (mainStarIds.has(star.starId) && star.brightness.level === "unmapped") {
    fail(`main star is unmapped: ${star.starId}`)
  }

  if (
    assistantStarIdsWithBrightness.has(star.starId) &&
    star.brightness.level === "unmapped"
  ) {
    fail(`assistant star is unmapped: ${star.starId}`)
  }

  if (
    maleficStarIdsWithBrightness.has(star.starId) &&
    star.brightness.level === "unmapped"
  ) {
    fail(`malefic star is unmapped: ${star.starId}`)
  }
})

viewModel.palaceDetails.forEach((palace) => {
  palace.starGroups.flatMap((group) => group.stars).forEach((star) => {
    if (star.category === "transformation") {
      if (star.brightness) {
        fail(`view model transformation star must not carry brightness: ${star.starId}`)
      }

      if (!star.displayLabel.includes(star.sourceLabel)) {
        fail(`view model transformation star is missing source label: ${star.starId}`)
      }

      if (!star.targetStarLabel || !star.displayLabel.includes(star.targetStarLabel)) {
        fail(`view model transformation star is missing target label: ${star.starId}`)
      }

      return
    }

    if (!star.brightness) {
      fail(`view model palace star is missing brightness: ${star.starId}`)
    }
  })
})

viewModel.starCatalogRows.forEach((row) => {
  if (row.category === "transformation") {
    if (row.brightness) {
      fail(`star catalog transformation row must not carry brightness: ${row.starId}`)
    }

    return
  }

  if (!row.brightness) {
    fail(`star catalog row is missing brightness: ${row.starId}`)
  }
})

console.log("Ziwei star brightness check passed.")

function assertBrightnessTableCoverage(label, table, starIds) {
  starIds.forEach((starId) => {
    const branchTable = table[starId]

    if (!branchTable) {
      fail(`${label} brightness table is missing: ${starId}`)
    }

    branches.forEach((branch) => {
      const level = branchTable[branch]

      if (!validLevels.has(level)) {
        fail(`invalid brightness level for ${starId} at ${branch}: ${level}`)
      }
    })
  })
}
