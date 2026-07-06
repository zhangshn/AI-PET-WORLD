import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "misc-star-panel.tsx",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const groupPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-misc-star-groups.ts",
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
  console.error(`Ziwei misc star panel check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  clientPath,
  groupPath,
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
const groupText = readFileSync(groupPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")

const groupMarkers = [
  "ZiweiMiscStarGroupKey",
  "\"romance\"",
  "\"nobleman\"",
  "\"solitary\"",
  "\"punishment\"",
  "buildMiscStarGroups",
  "countMiscSourceRules",
  "countMiscPalaces",
  "row.category !== \"misc\"",
  "placementRuleId?.match(/^misc\\.",
]

groupMarkers.forEach((marker) => {
  if (!groupText.includes(marker)) {
    fail(`misc grouping lib is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "export function MiscStarPanel",
  "杂曜专项总览",
  "查看总表杂曜",
  "buildMiscStarGroups",
  "countMiscSourceRules",
  "countMiscPalaces",
  "星曜 ID",
  "规则来源",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`misc panel component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "MiscStarPanel",
  "rows={viewModel.starCatalogRows}",
  "setSelectedStarCategory(\"misc\")",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const styleMarkers = [
  ".miscSummaryGrid",
  ".miscGroupStack",
  ".miscGroup",
  ".miscStarCard",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "杂曜专项总览",
  "misc-star-panel.tsx",
  "ziwei-misc-star-groups.ts",
  "check-misc-star-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker) && marker.endsWith(".tsx")) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei misc star panel check passed.")
