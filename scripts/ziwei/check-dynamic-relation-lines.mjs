import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const chartGridPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-chart-grid.tsx"
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx"
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
const executionDocPath = path.join(root, "data", "ziwei", "legacy-execution-verification-baseline-v1.txt")

function fail(message) {
  console.error(`[check-dynamic-relation-lines] ${message}`)
  process.exit(1)
}

for (const filePath of [
  chartGridPath,
  clientPath,
  stylePath,
  pageDocPath,
  executionDocPath
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const chartGridText = readFileSync(chartGridPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

for (const marker of [
  "palaceDetails: ZiweiPalaceDetailView[]",
  "buildRelationLines",
  "sourceBranch: props.selectedBranch",
  "sourceFlowType: props.selectedFlowType",
  "sourceFlowType",
  "CHART_GRID_POINTS",
  "chartRelationOverlay",
  "getRelationLineClassName",
  "getRelationLineToneClassName",
  "chartRelationLineOpposite",
  "chartRelationLineTrine",
  "chartRelationLineLiuNian",
  "relation.kind === \"opposite\" || relation.kind === \"trine\""
]) {
  if (!chartGridText.includes(marker)) {
    fail(`chart grid is missing marker: ${marker}`)
  }
}

for (const marker of [
  "selectedDynamicFlow",
  "sourceBranch: selectedDynamicFlow.palace",
  "source: \"selected\"",
  "source: \"dynamic\"",
  "chartRelationLineSelected",
  "chartRelationLineDynamic"
]) {
  if (chartGridText.includes(marker)) {
    fail(`chart grid should only draw current flow relation lines: ${marker}`)
  }
}

for (const marker of [
  "palaceDetails={viewModel.palaceDetails}",
  "dynamicFlows={viewModel.dynamicFlowDetails}",
  "selectedFlowType={selectedFlowType}"
]) {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
}

for (const marker of [
  ".chartRelationOverlay",
  ".chartRelationLine",
  ".chartRelationLineOpposite",
  ".chartRelationLineTrine",
  ".chartRelationLineNatal",
  ".chartRelationLineDaYun",
  ".chartRelationLineLiuNian",
  ".chartRelationLineLiuYue",
  ".chartRelationLineLiuRi",
  ".chartRelationLineLiuShi",
  "stroke-dasharray: 6 5",
  "display: none"
]) {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
}

for (const marker of [
  "三方四正动态线条",
  "只画当前查看盘",
  "对宫实线",
  "三方虚线",
  "check-dynamic-relation-lines.mjs"
]) {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }
}

for (const marker of [
  "| 119 | P18 | 十二宫主盘三方四正动态线条",
  "check-dynamic-relation-lines.mjs"
]) {
  if (!executionDocText.includes(marker)) {
    fail(`execution table is missing marker: ${marker}`)
  }
}

console.log("[check-dynamic-relation-lines] ok")
