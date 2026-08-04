import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const summaryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-view-share-summary.ts",
)
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "view-share-panel.tsx",
)
const registryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-module-registry.ts",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
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
const executionDocPath = path.join(root, "data", "ziwei", "legacy-execution-verification-baseline-v1.txt")

function fail(message) {
  console.error(`Ziwei view share panel check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  summaryPath,
  componentPath,
  registryPath,
  clientPath,
  stylePath,
  pageDocPath,
  directoryDocPath,
  executionDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const summaryText = readFileSync(summaryPath, "utf8")
const componentText = readFileSync(componentPath, "utf8")
const registryText = readFileSync(registryPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

const summaryMarkers = [
  "buildZiweiViewShareSummary",
  "ZiweiViewShareSummaryItem",
  "buildDefaultCollapsedModuleIds",
  "selectedBranch",
  "selectedFlowType",
  "selectedStarCategory",
  "selectedStarBrightness",
  "selectedPatternFilter",
  "getPatternFilterLabel",
  "openedModuleLabels",
  "closedModuleLabels",
]

summaryMarkers.forEach((marker) => {
  if (!summaryText.includes(marker)) {
    fail(`summary lib is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "export function ViewSharePanel",
  "navigator.clipboard.writeText",
  "copyWithTextarea",
  "manualUrlRef",
  "链接已选中",
  "window.location.href",
  "viewShareSummary",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`component is missing marker: ${marker}`)
  }
})

if (!registryText.includes('id: "view-share"')) {
  fail("module registry is missing view-share module")
}

const clientMarkers = [
  "buildZiweiViewShareSummary",
  "ViewSharePanel",
  'moduleId="view-share"',
  "viewShareSummary",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const styleMarkers = [
  ".viewShareSummary",
  ".viewShareSummary div",
  ".viewShareSummary dt",
  ".viewShareSummary dd",
  ".viewShareManualUrl",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "view-share-panel.tsx",
  "ziwei-view-share-summary.ts",
  "check-view-share-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker)) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

if (!executionDocText.includes("| 55 |")) {
  fail("execution table is missing row 55")
}

if (!executionDocText.includes("| 73 |")) {
  fail("execution table is missing row 73")
}

console.log("Ziwei view share panel check passed.")
