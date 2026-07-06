import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "palace-density-panel.tsx",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const densityPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-palace-density.ts",
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
  console.error(`Ziwei palace density panel check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  clientPath,
  densityPath,
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
const densityText = readFileSync(densityPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")

const densityMarkers = [
  "ZiweiPalaceDensityRow",
  "ZiweiPalaceDensitySummary",
  "buildPalaceDensitySummary",
  "CORE_DETAIL_CATEGORIES",
  "FLOW_DETAIL_CATEGORIES",
  "countSourceRules",
  "coreStarCount",
  "flowStarCount",
]

densityMarkers.forEach((marker) => {
  if (!densityText.includes(marker)) {
    fail(`palace density lib is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "export function PalaceDensityPanel",
  "宫位星曜密度",
  "buildPalaceDensitySummary",
  "DensityBar",
  "核心星曜",
  "周期流系",
  "props.onSelect(row.branch)",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`palace density component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "PalaceDensityPanel",
  "palaces={viewModel.palaceDetails}",
  "selectedBranch={selectedBranch}",
  "onSelect={setSelectedBranch}",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const styleMarkers = [
  ".palaceDensitySummaryGrid",
  ".palaceDensityGrid",
  ".palaceDensityCard",
  ".palaceDensityCardSelected",
  ".palaceDensityTrack",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "宫位星曜密度",
  "palace-density-panel.tsx",
  "ziwei-palace-density.ts",
  "check-palace-density-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker) && marker.endsWith(".tsx")) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei palace density panel check passed.")
