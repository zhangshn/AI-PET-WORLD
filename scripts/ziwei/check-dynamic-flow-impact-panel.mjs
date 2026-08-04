import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const libPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-dynamic-flow-impact.ts"
)
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "dynamic-flow-impact-panel.tsx"
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
  console.error(`[check-dynamic-flow-impact-panel] ${message}`)
  process.exit(1)
}

for (const filePath of [
  libPath,
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

const libText = readFileSync(libPath, "utf8")
const componentText = readFileSync(componentPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const registryText = readFileSync(registryPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

const libMarkers = [
  "buildDynamicFlowImpactSummary",
  "samePalaceOverlayCount",
  "transformationTargetCount",
  "jiPressureCount",
  "selectedBranchImpactCount",
  "buildPalaceOverlays",
  "buildTransformationOverlays",
  "buildJiPressures",
  "buildSelectedBranchImpacts",
  "groupFlowsByBranch"
]

for (const marker of libMarkers) {
  if (!libText.includes(marker)) {
    fail(`impact lib is missing marker: ${marker}`)
  }
}

const componentMarkers = [
  "export function DynamicFlowImpactPanel",
  "buildDynamicFlowImpactSummary",
  "流动盘叠加影响",
  "同宫叠加",
  "四化落点叠加",
  "化忌压力",
  "当前宫位牵动",
  "summary.palaceOverlays.map",
  "summary.transformationOverlays.map",
  "summary.jiPressures.map",
  "summary.selectedBranchImpacts.map"
]

for (const marker of componentMarkers) {
  if (!componentText.includes(marker)) {
    fail(`component is missing marker: ${marker}`)
  }
}

for (const marker of [
  "buildDynamicFlow(",
  "buildZiwei",
  "NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM"
]) {
  if (componentText.includes(marker) || libText.includes(marker)) {
    fail(`impact analysis should not recompute dynamic chart: ${marker}`)
  }
}

for (const marker of [
  "DynamicFlowImpactPanel",
  "moduleId=\"dynamic-impact\"",
  "flows={viewModel.dynamicFlowDetails}",
  "selectedBranch={selectedBranch}",
  "onSelectBranch={setSelectedBranch}"
]) {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
}

for (const marker of [
  'id: "dynamic-impact"',
  'label: "流动盘叠加影响"',
  'column: "center"',
  "defaultCollapsed: false"
]) {
  if (!registryText.includes(marker)) {
    fail(`module registry is missing marker: ${marker}`)
  }
}

for (const marker of [
  ".dynamicFlowImpactSummary",
  ".dynamicFlowImpactSection",
  ".dynamicFlowImpactGrid",
  ".dynamicFlowImpactCard",
  ".dynamicFlowImpactPressureList",
  ".dynamicFlowImpactCurrentList"
]) {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
}

for (const marker of [
  "流动盘叠加影响",
  "ziwei-dynamic-flow-impact.ts",
  "dynamic-flow-impact-panel.tsx",
  "check-dynamic-flow-impact-panel.mjs",
  "| 114 | P17 | 流动盘叠加影响分析"
]) {
  const text = marker.startsWith("| 114 |")
    ? executionDocText
    : `${pageDocText}\n${directoryDocText}`

  if (!text.includes(marker)) {
    fail(`docs are missing marker: ${marker}`)
  }
}

console.log("[check-dynamic-flow-impact-panel] ok")
