import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "debug-json-panel.tsx",
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
  console.error(`Ziwei debug JSON panel check failed: ${message}`)
  process.exit(1)
}

if (!existsSync(componentPath)) {
  fail("debug-json-panel.tsx is missing")
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
  '"use client"',
  'type DebugJsonTab = "summary" | "chart" | "dynamic"',
  "盘面摘要",
  "完整本命盘",
  "动态盘",
  "buildDebugSummary",
  "starCountsByCategory",
  "placementWarningCount",
  "validationWarningCount",
  "dynamicFlowCount",
  "activeDynamicFlowCount",
]

requiredComponentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`debug JSON panel is missing marker: ${marker}`)
  }
})

const requiredStyleMarkers = [
  ".debugTabs",
  ".debug",
]

requiredStyleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`debug JSON style is missing marker: ${marker}`)
  }
})

const requiredDocMarkers = [
  "调试 JSON 展示",
  "盘面摘要",
  "完整本命盘",
  "动态盘",
  "check-debug-json-panel.mjs",
]

requiredDocMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page structure doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei debug JSON panel check passed.")
