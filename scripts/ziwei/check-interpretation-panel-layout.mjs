import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "interpretation-panel.tsx",
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
  console.error(`Ziwei interpretation panel layout check failed: ${message}`)
  process.exit(1)
}

if (!existsSync(componentPath)) {
  fail("interpretation-panel.tsx is missing")
}

if (!existsSync(stylePath)) {
  fail("ziwei-page.module.css is missing")
}

if (!existsSync(pageDocPath)) {
  fail("PAGE_ACCEPTANCE.md is missing")
}

const componentText = readFileSync(componentPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")

const requiredComponentMarkers = [
  "InterpretationSection",
  "InterpretationItemCard",
  "collectSourceRuleIds",
  "整盘摘要",
  "规则来源追踪",
  "props.interpretation.debug.generatedBy",
  "props.interpretation.chartHighlights",
  "palaceItems",
  "sourceRuleIds",
]

requiredComponentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`interpretation panel is missing marker: ${marker}`)
  }
})

const requiredStyleMarkers = [
  ".interpretationSection",
  ".interpretationSectionHeader",
  ".ruleCodeList",
  ".ruleCode",
]

requiredStyleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`interpretation style is missing marker: ${marker}`)
  }
})

const requiredDocMarkers = [
  "解释层展示",
  "整盘摘要",
  "当前宫位解释",
  "规则来源追踪",
  "check-interpretation-panel-layout.mjs",
]

requiredDocMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page structure doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei interpretation panel layout check passed.")
