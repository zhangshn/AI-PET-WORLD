import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "palace-detail-panel.tsx",
)
const starGroupListPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-group-list.tsx",
)
const filterPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-star-group-filters.ts",
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

function fail(message) {
  console.error(`Ziwei palace detail layout check failed: ${message}`)
  process.exit(1)
}

if (!existsSync(componentPath)) {
  fail("palace-detail-panel.tsx is missing")
}

if (!existsSync(starGroupListPath)) {
  fail("star-group-list.tsx is missing")
}

if (!existsSync(filterPath)) {
  fail("ziwei-star-group-filters.ts is missing")
}

if (!existsSync(stylePath)) {
  fail("ziwei-page.module.css is missing")
}

if (!existsSync(pageDocPath)) {
  fail("PAGE_STRUCTURE.md is missing")
}

const componentText = readFileSync(componentPath, "utf8")
const starGroupListText = readFileSync(starGroupListPath, "utf8")
const filterText = readFileSync(filterPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")

const requiredComponentMarkers = [
  "CORE_DETAIL_CATEGORIES",
  "FLOW_DETAIL_CATEGORIES",
  "DetailSection",
  "宫位基础",
  "三方四正",
  "核心星曜",
  "周期与流系星曜",
  "安星调试",
  "props.palace.detailLines",
  "filterStarGroups",
]

requiredComponentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`palace detail panel is missing marker: ${marker}`)
  }
})

const expectedCoreCategories = [
  "main",
  "assistant",
  "malefic",
  "transformation",
  "misc",
]

expectedCoreCategories.forEach((category) => {
  if (!filterText.includes(`"${category}"`)) {
    fail(`core detail category is missing: ${category}`)
  }
})

const expectedFlowCategories = [
  "lifecycle",
  "yearly",
  "monthly",
  "dailyHourly",
]

expectedFlowCategories.forEach((category) => {
  if (!filterText.includes(`"${category}"`)) {
    fail(`flow detail category is missing: ${category}`)
  }
})

if (!starGroupListText.includes("emptyText?: string")) {
  fail("star group list does not support empty state copy")
}

const requiredStyleMarkers = [
  ".detailHero",
  ".detailSectionGrid",
  ".detailSection",
  ".detailSectionTitle",
  ".detailFacts",
  ".detailLineList",
]

requiredStyleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`detail style is missing marker: ${marker}`)
  }
})

const requiredDocMarkers = [
  "宫位基础",
  "三方四正",
  "核心星曜",
  "周期与流系星曜",
  "安星调试",
  "check-palace-detail-layout.mjs",
]

requiredDocMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page structure doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei palace detail layout check passed.")
