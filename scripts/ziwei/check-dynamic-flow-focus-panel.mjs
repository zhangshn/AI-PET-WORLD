import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "dynamic-flow-focus-panel.tsx"
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx"
)
const registryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-module-registry.ts"
)
const stylePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_styles",
  "ziwei-page.module.css"
)
const pageDocPath = path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md")
const directoryDocPath = path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md")
const executionDocPath = path.join(root, "data", "ziwei", "legacy-execution-verification-baseline-v1.txt")

function fail(message) {
  console.error(`[check-dynamic-flow-focus-panel] ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  clientPath,
  registryPath,
  stylePath,
  pageDocPath,
  directoryDocPath,
  executionDocPath
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const componentText = readFileSync(componentPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const registryText = readFileSync(registryPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

const componentMarkers = [
  "export function DynamicFlowFocusPanel",
  "ZiweiDynamicFlowDetailView",
  "当前流动盘",
  "flow.stemSourceLabel",
  "flow.influence.toFixed(2)",
  "flow.transformations.map",
  "flow.palaceDetail.relations.map",
  "flow.palaceDetail.starGroups",
  "flow.palaceDetail.detailLines.map",
  "mixedOrientation",
  "props.onSelectBranch(item.branch)",
  "props.onSelectBranch(relation.branch)"
]

for (const marker of componentMarkers) {
  if (!componentText.includes(marker)) {
    fail(`component is missing marker: ${marker}`)
  }
}

const forbiddenComponentMarkers = [
  "buildDynamicFlow",
  "buildZiwei",
  "NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM"
]

for (const marker of forbiddenComponentMarkers) {
  if (componentText.includes(marker)) {
    fail(`component should not recompute dynamic chart: ${marker}`)
  }
}

const clientMarkers = [
  "DynamicFlowFocusPanel",
  "selectedDynamicFlowDetail",
  "viewModel.dynamicFlowDetails.find",
  "moduleId=\"dynamic-focus\"",
  "flow={selectedDynamicFlowDetail}",
  "onSelectBranch={setSelectedBranch}"
]

for (const marker of clientMarkers) {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
}

const registryMarkers = [
  'id: "dynamic-focus"',
  'label: "当前流动盘"',
  'column: "center"',
  "defaultCollapsed: false"
]

for (const marker of registryMarkers) {
  if (!registryText.includes(marker)) {
    fail(`module registry is missing marker: ${marker}`)
  }
}

const styleMarkers = [
  ".dynamicFlowFocusHero",
  ".dynamicFlowFocusPalaceButton",
  ".dynamicFlowFocusFacts",
  ".dynamicFlowFocusTransformationGrid",
  ".dynamicFlowFocusRelationGrid",
  ".dynamicFlowFocusLineList"
]

for (const marker of styleMarkers) {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
}

const docMarkers = [
  "当前流动盘焦点",
  "dynamic-flow-focus-panel.tsx",
  "check-dynamic-flow-focus-panel.mjs",
  "| 112 | P17 | 当前流动盘焦点模块"
]

for (const marker of docMarkers) {
  const text = marker.startsWith("| 112 |")
    ? executionDocText
    : `${pageDocText}\n${directoryDocText}`

  if (!text.includes(marker)) {
    fail(`docs are missing marker: ${marker}`)
  }
}

console.log("[check-dynamic-flow-focus-panel] ok")
