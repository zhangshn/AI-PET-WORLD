import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const summaryLibPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-star-brightness-summary.ts",
)
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-brightness-summary-panel.tsx",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const registryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-module-registry.ts",
)
const catalogTablePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-catalog-table.tsx",
)
const urlStatePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-url-state.ts",
)
const shareSummaryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-view-share-summary.ts",
)
const stylePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_styles",
  "ziwei-page.module.css",
)
const pageDocPath = path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md")
const directoryDocPath = path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md")
const executionDocPath = path.join(root, "docs", "ziwei", "EXECUTION_TABLE.md")

function fail(message) {
  console.error(`Ziwei star brightness summary check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  summaryLibPath,
  componentPath,
  clientPath,
  registryPath,
  catalogTablePath,
  urlStatePath,
  shareSummaryPath,
  stylePath,
  pageDocPath,
  directoryDocPath,
  executionDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const summaryLibText = readFileSync(summaryLibPath, "utf8")
const componentText = readFileSync(componentPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const registryText = readFileSync(registryPath, "utf8")
const catalogTableText = readFileSync(catalogTablePath, "utf8")
const urlStateText = readFileSync(urlStatePath, "utf8")
const shareSummaryText = readFileSync(shareSummaryPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

const summaryLibMarkers = [
  "StarCatalogBrightnessFilter",
  "STAR_BRIGHTNESS_FILTER_ORDER",
  "STAR_BRIGHTNESS_FILTER_LABELS",
  "buildStarCatalogBrightnessFilterValues",
  "buildStarBrightnessSummaries",
  "getStarBrightnessFilterLabel",
]

summaryLibMarkers.forEach((marker) => {
  if (!summaryLibText.includes(marker)) {
    fail(`summary lib is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "StarBrightnessSummaryPanel",
  "庙旺落陷汇总",
  "selectedBrightness",
  "onSelectBrightness",
  "onOpenCatalog",
  "buildStarBrightnessSummaries",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "selectedStarBrightness",
  "setSelectedStarBrightness",
  "buildStarCatalogBrightnessFilterValues",
  "StarBrightnessSummaryPanel",
  'moduleId="brightness-summary"',
  "selectedBrightness={selectedStarBrightness}",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

if (!registryText.includes('id: "brightness-summary"')) {
  fail("module registry is missing brightness-summary module")
}

const catalogMarkers = [
  "selectedBrightness",
  "onBrightnessChange",
  "buildBrightnessOptions",
  "params.brightness",
]

catalogMarkers.forEach((marker) => {
  if (!catalogTableText.includes(marker)) {
    fail(`catalog table is missing marker: ${marker}`)
  }
})

const urlMarkers = [
  'brightness: "brightness"',
  "selectedStarBrightness",
  "starBrightnessLevels",
]

urlMarkers.forEach((marker) => {
  if (!urlStateText.includes(marker)) {
    fail(`URL state is missing marker: ${marker}`)
  }
})

if (!shareSummaryText.includes("selectedStarBrightness")) {
  fail("view share summary is missing brightness state")
}

const styleMarkers = [
  ".brightnessSummaryGrid",
  ".brightnessSummaryList",
  ".brightnessSummaryCard",
  ".brightnessSummaryHeader",
  ".brightnessSummaryFacts",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "star-brightness-summary-panel.tsx",
  "ziwei-star-brightness-summary.ts",
  "check-star-brightness-summary-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker)) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

if (!executionDocText.includes("| 59 |")) {
  fail("execution table is missing row 59")
}

console.log("Ziwei star brightness summary check passed.")
