import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "rule-source-overview-panel.tsx",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const indexPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-rule-source-index.ts",
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
  console.error(`Ziwei rule source overview panel check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  clientPath,
  indexPath,
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
const indexText = readFileSync(indexPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")

const indexMarkers = [
  "ZiweiRuleSourceIndexRow",
  "ZiweiRuleSourceCategoryGroup",
  "buildRuleSourceIndex",
  "countRuleSourcePalaces",
  "row.placementRuleId",
  "appendUnique",
]

indexMarkers.forEach((marker) => {
  if (!indexText.includes(marker)) {
    fail(`rule source index lib is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "export function RuleSourceOverviewPanel",
  "规则来源总览",
  "buildRuleSourceIndex",
  "countRuleSourcePalaces",
  "查看全部星曜",
  "onSelectCategory(group.category)",
  "rule.starLabels.join",
  "rule.palaceLabels.join",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`rule source overview component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "RuleSourceOverviewPanel",
  "rows={viewModel.starCatalogRows}",
  "onSelectCategory={setSelectedStarCategory}",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const styleMarkers = [
  ".ruleSourceSummaryGrid",
  ".ruleSourceGroupStack",
  ".ruleSourceCard",
  ".ruleSourceFacts",
  ".inlineTextButton",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "规则来源总览",
  "rule-source-overview-panel.tsx",
  "ziwei-rule-source-index.ts",
  "check-rule-source-overview-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker) && marker.endsWith(".tsx")) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei rule source overview panel check passed.")
