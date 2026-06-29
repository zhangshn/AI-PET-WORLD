import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const contractPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "contracts",
  "page-view-contract.ts",
)
const builderPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "page-view",
  "page-view-model-builder.ts",
)
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "dynamic-flow-overview-panel.tsx",
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
const pageDocPath = path.join(root, "docs", "ziwei", "PAGE_STRUCTURE.md")
const directoryDocPath = path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md")

function fail(message) {
  console.error(`Ziwei dynamic flow overview panel check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  contractPath,
  builderPath,
  componentPath,
  clientPath,
  stylePath,
  pageDocPath,
  directoryDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const contractText = readFileSync(contractPath, "utf8")
const builderText = readFileSync(builderPath, "utf8")
const componentText = readFileSync(componentPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")

const contractMarkers = [
  "export interface ZiweiDynamicFlowDetailView",
  "dynamicFlowDetails: ZiweiDynamicFlowDetailView[]",
  "palaceDetail?: ZiweiPalaceDetailView",
  "sourceRuleCount: number",
]

contractMarkers.forEach((marker) => {
  if (!contractText.includes(marker)) {
    fail(`contract is missing marker: ${marker}`)
  }
})

const builderMarkers = [
  "buildDynamicFlowDetails",
  "buildDynamicFlowDetailView",
  "buildDynamicTabView",
  "dynamicTabs: dynamicFlowDetails.map(buildDynamicTabView)",
  "dynamicFlowDetails,",
  "sourceRuleCount",
  "palaceDetail: buildPalaceDetailView",
]

builderMarkers.forEach((marker) => {
  if (!builderText.includes(marker)) {
    fail(`view model builder is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "export function DynamicFlowOverviewPanel",
  "动态流完整明细",
  "flow.influence.toFixed(2)",
  "flow.starCount",
  "flow.sourceRuleCount",
  "flow.palaceDetail.starGroups",
  "StarGroupList",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`dynamic flow overview component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "DynamicFlowOverviewPanel",
  "flows={viewModel.dynamicFlowDetails}",
  "selectDynamicFlowDetail",
  "setSelectedFlowType(flow.type)",
  "setSelectedBranch(flow.palace)",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const styleMarkers = [
  ".dynamicFlowOverviewGrid",
  ".dynamicFlowCard",
  ".dynamicFlowCardSelected",
  ".dynamicFlowCardHeader",
  ".dynamicFlowFacts",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "动态流完整明细",
  "dynamic-flow-overview-panel.tsx",
  "check-dynamic-flow-overview-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker) && marker.endsWith(".tsx")) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei dynamic flow overview panel check passed.")
