import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "same-name-star-panel.tsx",
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
  "ziwei-same-name-stars.ts",
)
const stylePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_styles",
  "ziwei-page.module.css",
)
const pageDocPath = path.join(root, "docs", "ziwei", "PAGE_STRUCTURE.md")
const directoryDocPath = path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md")

function fail(message) {
  console.error(`Ziwei same name star panel check failed: ${message}`)
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
  "ZiweiSameNameStarGroup",
  "buildSameNameStarGroups",
  "new Set(groupRows.map((row) => row.starId)).size > 1",
  "categoryLabels",
  "ruleIds",
  "palaceLabels",
]

indexMarkers.forEach((marker) => {
  if (!indexText.includes(marker)) {
    fail(`same-name star lib is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "export function SameNameStarPanel",
  "同名星曜校准",
  "buildSameNameStarGroups",
  "countUniqueRules",
  "onSelectCategory(row.category)",
  "星曜 ID",
  "规则来源",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`same-name panel component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "SameNameStarPanel",
  "rows={viewModel.starCatalogRows}",
  "onSelectCategory={setSelectedStarCategory}",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const styleMarkers = [
  ".sameNameSummaryGrid",
  ".sameNameGroupStack",
  ".sameNameGroup",
  ".sameNameRecord",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "同名星曜校准",
  "same-name-star-panel.tsx",
  "ziwei-same-name-stars.ts",
  "check-same-name-star-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker) && marker.endsWith(".tsx")) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei same name star panel check passed.")
