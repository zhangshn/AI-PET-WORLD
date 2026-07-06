import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-category-summary-panel.tsx",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const summaryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-star-category-summary.ts",
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

function fail(message) {
  console.error(`Ziwei star category summary panel check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  clientPath,
  summaryPath,
  stylePath,
  pageDocPath,
  directoryDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const componentText = readFileSync(componentPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const summaryText = readFileSync(summaryPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")

const summaryMarkers = [
  "ZiweiStarCategorySummary",
  "buildStarCategorySummaries",
  "countStarCategoryRules",
  "palaceLabels",
  "ruleCount",
]

summaryMarkers.forEach((marker) => {
  if (!summaryText.includes(marker)) {
    fail(`star category summary lib is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "export function StarCategorySummaryPanel",
  "星曜分类统计",
  "buildStarCategorySummaries",
  "countStarCategoryRules",
  "summary.palaceLabels.join",
  "onSelectCategory(summary.category)",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`star category summary component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "StarCategorySummaryPanel",
  "rows={viewModel.starCatalogRows}",
  "onSelectCategory={setSelectedStarCategory}",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const styleMarkers = [
  ".categorySummaryGrid",
  ".categorySummaryList",
  ".categorySummaryCard",
  ".categorySummaryFacts",
  ".categoryPalaceText",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "星曜分类统计",
  "star-category-summary-panel.tsx",
  "ziwei-star-category-summary.ts",
  "check-star-category-summary-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker) && marker.endsWith(".tsx")) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei star category summary panel check passed.")
