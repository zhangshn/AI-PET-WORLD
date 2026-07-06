import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "palace-overview-panel.tsx",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const filterPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-star-group-filters.ts",
)
const detailPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "palace-detail-panel.tsx",
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

function fail(message) {
  console.error(`Ziwei palace overview panel check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  clientPath,
  filterPath,
  detailPath,
  stylePath,
  pageDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const componentText = readFileSync(componentPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const filterText = readFileSync(filterPath, "utf8")
const detailText = readFileSync(detailPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")

const componentMarkers = [
  "export function PalaceOverviewPanel",
  "props.palaces.map",
  "十二宫完整明细",
  "countSourceRules",
  "CORE_DETAIL_CATEGORIES",
  "FLOW_DETAIL_CATEGORIES",
  "StarGroupList",
  "props.onSelect(palace.branch)",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`overview component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "PalaceOverviewPanel",
  "palaces={viewModel.palaceDetails}",
  "onSelect={setSelectedBranch}",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const filterMarkers = [
  "CORE_DETAIL_CATEGORIES",
  "FLOW_DETAIL_CATEGORIES",
  "filterStarGroups",
  "countStars",
  "countSourceRules",
]

filterMarkers.forEach((marker) => {
  if (!filterText.includes(marker)) {
    fail(`shared filter lib is missing marker: ${marker}`)
  }
})

if (detailText.includes("new Set<ZiweiStarCategory>")) {
  fail("palace detail panel still defines star category sets locally")
}

const styleMarkers = [
  ".overviewGrid",
  ".overviewCard",
  ".overviewCardSelected",
  ".overviewHeader",
  ".overviewSections",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "十二宫完整明细",
  "palace-overview-panel.tsx",
  "ziwei-star-group-filters.ts",
  "check-palace-overview-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei palace overview panel check passed.")
