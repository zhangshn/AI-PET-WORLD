import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "dynamic-flow-tabs.tsx",
)
const contractPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "contracts",
  "page-view-contract.ts",
)
const viewModelBuilderPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "page-view",
  "page-view-model-builder.ts",
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
  console.error(`Ziwei dynamic flow panel check failed: ${message}`)
  process.exit(1)
}

const requiredFiles = [
  componentPath,
  contractPath,
  viewModelBuilderPath,
  stylePath,
  pageDocPath,
]

requiredFiles.forEach((filePath) => {
  if (!existsSync(filePath)) {
    fail(`${path.relative(root, filePath)} is missing`)
  }
})

const componentText = readFileSync(componentPath, "utf8")
const contractText = readFileSync(contractPath, "utf8")
const viewModelBuilderText = readFileSync(viewModelBuilderPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")

const requiredContractMarkers = [
  "ZiweiDynamicDebugView",
  "directionLabel",
  "startAge",
  "currentAge",
  "isDaYunStarted",
  "xiaoXianDirectionLabel",
  "xiaoXianStartPalaceLabel",
  "xiaoXianPalaceLabel",
  "douJunPalaceLabel",
  "activeFlowCount",
  "totalFlowCount",
  "dynamicDebug?: ZiweiDynamicDebugView",
]

requiredContractMarkers.forEach((marker) => {
  if (!contractText.includes(marker)) {
    fail(`dynamic debug contract is missing marker: ${marker}`)
  }
})

const requiredBuilderMarkers = [
  "buildDynamicDebugView",
  "DYNAMIC_DIRECTION_LABELS",
  "dynamicDebug: input.dynamicChart",
  "dynamicChart.debug.direction",
  "dynamicChart.debug.xiaoXianPalace",
  "dynamicChart.debug.douJunPalace",
  "dynamicChart.flows.filter",
]

requiredBuilderMarkers.forEach((marker) => {
  if (!viewModelBuilderText.includes(marker)) {
    fail(`page view builder is missing marker: ${marker}`)
  }
})

const requiredComponentMarkers = [
  '"use client"',
  "dynamicDebug?: ZiweiDynamicDebugView",
  "行运方向",
  "起运岁数",
  "当前年龄",
  "启用流",
  "xiaoXianDirectionLabel",
  "xiaoXianPalaceLabel",
  "douJunPalaceLabel",
  "flowStatusActive",
  "flowStatusInactive",
]

requiredComponentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`dynamic flow component is missing marker: ${marker}`)
  }
})

const requiredStyleMarkers = [
  ".dynamicSummary",
  ".dynamicFact",
  ".flowStatusActive",
  ".flowStatusInactive",
]

requiredStyleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`dynamic flow style is missing marker: ${marker}`)
  }
})

const requiredDocMarkers = [
  "动态流展示",
  "行运方向",
  "起运岁数",
  "启用流数量",
  "check-dynamic-flow-panel.mjs",
]

requiredDocMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page structure doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei dynamic flow panel check passed.")
