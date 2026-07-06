import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const birthInputPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "birth-input-panel.tsx"
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx"
)
const chartGridPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-chart-grid.tsx"
)
const flowDepthPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-dynamic-flow-depth.ts"
)
const pageDocPath = path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md")
const closureDocPath = path.join(
  root,
  "docs",
  "ziwei",
  "DYNAMIC_FLOW_CLOSURE_REPORT.md"
)
const executionDocPath = path.join(root, "docs", "ziwei", "EXECUTION_TABLE.md")

function fail(message) {
  console.error(`[check-flow-time-palace-sync] ${message}`)
  process.exit(1)
}

for (const filePath of [
  birthInputPath,
  clientPath,
  chartGridPath,
  flowDepthPath,
  pageDocPath,
  closureDocPath,
  executionDocPath
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const birthInputText = readFileSync(birthInputPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const chartGridText = readFileSync(chartGridPath, "utf8")
const flowDepthText = readFileSync(flowDepthPath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const closureDocText = readFileSync(closureDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

for (const marker of [
  "isZiweiDynamicFlowWithinSelectedDepth",
  "isFlowTimeSelected",
  "selectFlowType(\"natal\")"
]) {
  if (!birthInputText.includes(marker)) {
    fail(`birth input panel is missing marker: ${marker}`)
  }
}

for (const marker of [
  "ZIWEI_DYNAMIC_FLOW_DEPTH",
  "daYun: 1",
  "liuNian: 2",
  "liuYue: 3",
  "liuRi: 4",
  "liuShi: 5",
  "isZiweiDynamicFlowWithinSelectedDepth"
]) {
  if (!flowDepthText.includes(marker)) {
    fail(`dynamic flow depth helper is missing marker: ${marker}`)
  }
}

for (const marker of [
  "selectFlowTypeFromTimePicker",
  "refreshZiweiChart",
  "commitFlowTime",
  "selectedFlowTypeAfterRefresh",
  "viewModel.dynamicFlowDetails.find",
  "response.data.viewModel.dynamicFlowDetails.find",
  "setSelectedFlowType(flowType)",
  "setSelectedFlowType(params.selectedFlowTypeAfterRefresh)",
  "setSelectedBranch(",
  "flow?.palace",
  "viewModel.selectedPalace?.branch",
  "onSelectFlowType={selectFlowTypeFromTimePicker}"
]) {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
}

if (clientText.includes("selectedFlowType: urlState.selectedFlowType ?? selectedFlowType")) {
  fail("initial page state should not restore stale dynamic flow from URL")
}

if (clientText.includes("urlFlowBranch")) {
  fail("initial page state should not move palace by stale URL flow")
}

for (const marker of [
  "sourceBranch: props.selectedBranch",
  "sourceFlowType: props.selectedFlowType"
]) {
  if (!chartGridText.includes(marker)) {
    fail(`chart grid relation lines are missing marker: ${marker}`)
  }
}

for (const marker of [
  "流动时间切换当前查看盘时",
  "主盘当前宫位同步跳到该流的命宫",
  "层级累计高亮"
]) {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }
}

for (const marker of [
  "palace=mao&flow=daYun",
  "同步回归原盘命宫",
  "层级累计高亮"
]) {
  if (!closureDocText.includes(marker)) {
    fail(`closure report is missing marker: ${marker}`)
  }
}

if (!executionDocText.includes("| 122 | P18 | 流动时间命宫联动修正")) {
  fail("execution table is missing P18-122 row")
}

console.log("[check-flow-time-palace-sync] ok")
