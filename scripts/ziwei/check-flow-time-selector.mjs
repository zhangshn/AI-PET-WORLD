import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
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
const executionDocPath = path.join(root, "docs", "ziwei", "EXECUTION_TABLE.md")

function fail(message) {
  console.error(`[check-flow-time-selector] ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  clientPath,
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
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

const componentMarkers = [
  "export function FlowTimePicker",
  "FlowTimeRow",
  "LUNAR_MONTH_OPTIONS",
  "LUNAR_DAY_OPTIONS",
  "dynamicDebug?: ZiweiDynamicDebugView",
  "const limitStartAge = props.dynamicDebug?.startAge ?? 1",
  "getAgeWindowStart({",
  "当前小限",
  "流年斗君",
  "props.dynamicDebug.douJunPalaceLabel",
  "props.dynamicDebug.xiaoXianPalaceLabel",
  "updateFlowAge",
  "currentYear: props.form.year + age",
  "onSelectFlowType?: (flowType: ZiweiDynamicFlowType) => void",
  "onCommitFlowTime?: (form: ZiweiFormState, flowType: ZiweiDynamicFlowType) => void",
  "selectedFlowType: ZiweiDynamicFlowType",
  "selectFlowType",
  "isZiweiDynamicFlowWithinSelectedDepth",
  "isFlowTimeSelected",
  "selectFlowAge",
  "props.onCommitFlowTime?.(nextForm, flowType)",
  "selectDaYunAge",
  "selectFlowType(\"natal\")",
  "updateFlowValue",
  "\"daYun\"",
  "\"liuNian\"",
  "\"liuYue\"",
  "\"liuRi\"",
  "\"liuShi\"",
  "shiftFlowDecade",
  "流动时间",
  "大限",
  "流年小限",
  "流月",
  "流日",
  "流时",
  "ZIWEI_TIME_BRANCH_OPTIONS.map",
  "onChange: (form: ZiweiFormState) => void"
]

for (const marker of componentMarkers) {
  if (!componentText.includes(marker)) {
    fail(`birth input panel is missing marker: ${marker}`)
  }
}

const forbiddenComponentMarkers = [
  '<NumberField label="流年"',
  '<NumberField label="流月"',
  '<NumberField label="流日"',
  "LIMIT_START_AGE",
  "props.onSubmit",
  "props.loading"
]

for (const marker of forbiddenComponentMarkers) {
  if (componentText.includes(marker)) {
    fail(`flow time selector should not keep old flow input marker: ${marker}`)
  }
}

const clientMarkers = [
  "FlowTimePicker",
  "chartFlowTimeBlock",
  "flowTimeSubmitButton",
  "form={form}",
  "dynamicDebug={viewModel.dynamicDebug}",
  "selectedFlowType={selectedFlowType}",
  "onChange={setForm}",
  "onCommitFlowTime={commitFlowTime}",
  "refreshZiweiChart",
  "selectedFlowTypeAfterRefresh",
  "selectFlowTypeFromTimePicker",
  "onSelectFlowType={selectFlowTypeFromTimePicker}",
  "flow?.palace",
  "onClick={submit}"
]

for (const marker of clientMarkers) {
  if (!clientText.includes(marker)) {
    fail(`ziwei client page is missing marker: ${marker}`)
  }
}

const styleMarkers = [
  ".flowTimePicker",
  ".chartFlowTimeBlock",
  ".flowTimeSubmitButton",
  ".flowTimeHeader",
  ".flowTimeHeader small",
  ".flowTimeTable",
  ".flowTimeRow",
  ".flowTimeRowLabel",
  ".flowTimeCells",
  ".flowTimeCell",
  ".flowTimeCellActive",
  ".flowTimeArrowButton",
  "overflow-x: auto"
]

for (const marker of styleMarkers) {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
}

const docMarkers = [
  "流动时间点击选择器",
  "流动时间盘下移",
  "birth-input-panel.tsx",
  "ziwei-client-page.tsx",
  "check-flow-time-selector.mjs"
]

for (const marker of docMarkers) {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }
}

if (!directoryDocText.includes("check-flow-time-selector.mjs")) {
  fail("directory doc is missing check-flow-time-selector.mjs")
}

if (!executionDocText.includes("| 110 | P17 | 流动时间点击选择器")) {
  fail("execution table is missing P17-110 row")
}

if (!executionDocText.includes("| 111 | P17 | 流动时间盘下移与宫格紧缩")) {
  fail("execution table is missing P17-111 row")
}

console.log("[check-flow-time-selector] ok")
