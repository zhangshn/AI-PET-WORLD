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
  console.error(`[check-dynamic-palace-markers] ${message}`)
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
  "dynamicFlows: ZiweiDynamicFlowDetailView[]",
  "selectedFlowType: ZiweiDynamicFlowDetailView[\"type\"]",
  "buildDynamicMarkersByBranch",
  "buildSelectedDynamicSectorMarkersByBranch",
  "ZIWEI_DYNAMIC_SECTOR_ORDER",
  "ZIWEI_DYNAMIC_SECTOR_LABELS",
  "formatDynamicFlowScopeLabel",
  "formatDynamicLifeMarkerLabel",
  "getDynamicPalaceMarkerClassName",
  "getDynamicPalaceMarkerToneClassName",
  "原命",
  "本命",
  "`${flow.label}命`",
  "dynamicPalaceMarkerLiuNian",
  "dynamicPalaceMarkerLiuYue",
  "dynamicPalaceMarkerLiuRi",
  "palaceTimeLayer",
  "palaceStaticMarkers",
  "DYNAMIC_SECTOR_MARKER_DISPLAY_LIMIT",
  "DYNAMIC_STAR_DISPLAY_LIMIT",
  "dynamicOverflowMarker",
  "compareSelectedDynamicStars",
  "getDynamicStarKindClassName",
  "dynamicStarTransformation",
  "dynamicSectorMarkers",
  "dynamicSectorMarker",
  "dynamicPalaceMarkerActive"
]) {
  if (!chartGridText.includes(marker)) {
    fail(`chart grid is missing marker: ${marker}`)
  }
}

for (const marker of [
  "dynamicFlows={viewModel.dynamicFlowDetails}",
  "selectedFlowType={selectedFlowType}"
]) {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
}

for (const marker of [
  ".natalPalaceMarker",
  ".palaceTimeLayer",
  ".palaceStaticMarkers",
  ".dynamicOverflowMarker",
  ".dynamicStarTransformation",
  ".dynamicStarFlowing",
  ".dynamicStarAnnualCycle",
  ".dynamicSectorMarkers",
  ".dynamicPalaceMarker",
  ".dynamicSectorMarker",
  ".dynamicPalaceMarkerNatal",
  ".dynamicPalaceMarkerDaYun",
  ".dynamicPalaceMarkerLiuNian",
  ".dynamicPalaceMarkerLiuYue",
  ".dynamicPalaceMarkerLiuRi",
  ".dynamicPalaceMarkerLiuShi",
  ".dynamicPalaceMarkerActive"
]) {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
}

for (const marker of [
  "动态命宫标记",
  "原盘命宫",
  "流年命宫",
  "不同颜色",
  "check-dynamic-palace-markers.mjs"
]) {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }
}

for (const marker of [
  "| 117 | P18 | 十二宫主盘动态命宫标记",
  "check-dynamic-palace-markers.mjs"
]) {
  if (!executionDocText.includes(marker)) {
    fail(`execution table is missing marker: ${marker}`)
  }
}

console.log("[check-dynamic-palace-markers] ok")
