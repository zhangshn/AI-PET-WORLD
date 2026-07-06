import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-catalog-table.tsx",
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
  console.error(`Ziwei star catalog table check failed: ${message}`)
  process.exit(1)
}

if (!existsSync(componentPath)) {
  fail("star-catalog-table.tsx is missing")
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
  "StarCatalogCategoryFilter",
  "buildCategoryOptions",
  "buildPalaceOptions",
  "buildBrightnessOptions",
  "filterRows",
  "getPalaceFilterKey",
  "formatPalaceLabel",
  "brightness",
  "selectedBrightness",
  "onBrightnessChange",
  "placementRuleId",
  "输入星曜、庙旺或规则 ID",
  "庙旺",
  "全部分类",
  "全部宫位",
  "清空",
]

requiredComponentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`star catalog table is missing marker: ${marker}`)
  }
})

const requiredStyleMarkers = [
  ".tableFilters",
  ".secondaryButton",
  ".brightnessBadge",
  ".ruleCode",
]

requiredStyleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`star catalog table style is missing marker: ${marker}`)
  }
})

const requiredDocMarkers = [
  "星曜总表",
  "分类筛选",
  "落宫筛选",
  "庙旺落陷",
  "规则关键词",
  "check-star-catalog-table.mjs",
]

requiredDocMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page structure doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei star catalog table check passed.")
