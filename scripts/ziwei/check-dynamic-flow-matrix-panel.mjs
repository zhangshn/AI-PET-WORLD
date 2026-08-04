import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "dynamic-flow-matrix-panel.tsx"
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
  console.error(`[check-dynamic-flow-matrix-panel] ${message}`)
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
  "export function DynamicFlowMatrixPanel",
  "流动盘总览矩阵",
  "activeFlowCount",
  "transformationCount",
  "sourceRuleCount",
  "props.flows.map",
  "flow.transformations.map",
  "flow.palaceDetail.relations.map",
  "flow.palaceDetail.starGroups",
  "props.onSelectFlow(flow)",
  "props.onSelectBranch(item.branch)",
  "mixedOrientation"
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
  "DynamicFlowMatrixPanel",
  "moduleId=\"dynamic-matrix\"",
  "flows={viewModel.dynamicFlowDetails}",
  "selectedType={selectedFlowType}",
  "onSelectFlow={selectDynamicFlowDetail}",
  "onSelectBranch={setSelectedBranch}"
]

for (const marker of clientMarkers) {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
}

const registryMarkers = [
  'id: "dynamic-matrix"',
  'label: "流动盘总览矩阵"',
  'column: "center"',
  "defaultCollapsed: false"
]

for (const marker of registryMarkers) {
  if (!registryText.includes(marker)) {
    fail(`module registry is missing marker: ${marker}`)
  }
}

const styleMarkers = [
  ".dynamicFlowMatrixSummary",
  ".dynamicFlowMatrixGrid",
  ".dynamicFlowMatrixCard",
  ".dynamicFlowMatrixCardSelected",
  ".dynamicFlowMatrixTransformationList",
  ".dynamicFlowMatrixRelationList"
]

for (const marker of styleMarkers) {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
}

const docMarkers = [
  "流动盘总览矩阵",
  "dynamic-flow-matrix-panel.tsx",
  "check-dynamic-flow-matrix-panel.mjs",
  "| 113 | P17 | 流动盘总览矩阵"
]

for (const marker of docMarkers) {
  const text = marker.startsWith("| 113 |")
    ? executionDocText
    : `${pageDocText}\n${directoryDocText}`

  if (!text.includes(marker)) {
    fail(`docs are missing marker: ${marker}`)
  }
}

console.log("[check-dynamic-flow-matrix-panel] ok")
