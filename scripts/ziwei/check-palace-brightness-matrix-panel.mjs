import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "palace-brightness-matrix-panel.tsx",
)
const matrixPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-palace-brightness-matrix.ts",
)
const summaryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-star-brightness-summary.ts",
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
  console.error(`Ziwei palace brightness matrix check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  matrixPath,
  summaryPath,
  clientPath,
  registryPath,
  stylePath,
  pageDocPath,
  directoryDocPath,
  executionDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const componentText = readFileSync(componentPath, "utf8")
const matrixText = readFileSync(matrixPath, "utf8")
const summaryText = readFileSync(summaryPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const registryText = readFileSync(registryPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

const matrixMarkers = [
  "ZiweiPalaceBrightnessMatrixRow",
  "ZiweiPalaceBrightnessMatrixSummary",
  "buildPalaceBrightnessMatrix",
  "STAR_BRIGHTNESS_FILTER_ORDER",
  "STAR_BRIGHTNESS_FILTER_LABELS",
  "mappedStarCount",
  "noFixedTableCount",
  "buildLevelTotals",
]

matrixMarkers.forEach((marker) => {
  if (!matrixText.includes(marker)) {
    fail(`matrix lib is missing marker: ${marker}`)
  }
})

if (!summaryText.includes("StarCatalogBrightnessFilter")) {
  fail("brightness summary lib must remain the shared filter source")
}

const componentMarkers = [
  "PalaceBrightnessMatrixPanel",
  "庙旺落陷分布矩阵",
  "buildPalaceBrightnessMatrix",
  "selectedBrightness",
  "onSelectBranch",
  "onSelectBrightness",
  "onOpenCatalog",
  "palaceBrightnessLevelGrid",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "PalaceBrightnessMatrixPanel",
  'moduleId="brightness-matrix"',
  "selectedBrightness={selectedStarBrightness}",
  "onSelectBranch={setSelectedBranch}",
  "onSelectBrightness={setSelectedStarBrightness}",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

if (!registryText.includes('id: "brightness-matrix"')) {
  fail("module registry is missing brightness-matrix module")
}

const styleMarkers = [
  ".palaceBrightnessSummaryGrid",
  ".palaceBrightnessTotals",
  ".brightnessTotalButton",
  ".palaceBrightnessMatrixGrid",
  ".palaceBrightnessMatrixCard",
  ".palaceBrightnessLevelGrid",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "palace-brightness-matrix-panel.tsx",
  "ziwei-palace-brightness-matrix.ts",
  "check-palace-brightness-matrix-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker)) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

if (!executionDocText.includes("| 60 |")) {
  fail("execution table is missing row 60")
}

console.log("Ziwei palace brightness matrix check passed.")
