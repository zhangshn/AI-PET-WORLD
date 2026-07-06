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
const viewModelBuilderPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "page-view",
  "page-view-model-builder.ts",
)
const starGroupListPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-group-list.tsx",
)
const palaceDetailPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "palace-detail-panel.tsx",
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
  console.error(`Ziwei star detail view check failed: ${message}`)
  process.exit(1)
}

const requiredFiles = [
  contractPath,
  viewModelBuilderPath,
  starGroupListPath,
  palaceDetailPath,
  stylePath,
  pageDocPath,
]

requiredFiles.forEach((filePath) => {
  if (!existsSync(filePath)) {
    fail(`${path.relative(root, filePath)} is missing`)
  }
})

const contractText = readFileSync(contractPath, "utf8")
const viewModelBuilderText = readFileSync(viewModelBuilderPath, "utf8")
const starGroupListText = readFileSync(starGroupListPath, "utf8")
const palaceDetailText = readFileSync(palaceDetailPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")

const requiredContractMarkers = [
  "ZiweiPlacementRuleId",
  "ZiweiStarBrightness",
  "categoryLabel: string",
  "placementRuleId: ZiweiPlacementRuleId",
  "brightness?: ZiweiStarBrightness",
]

requiredContractMarkers.forEach((marker) => {
  if (!contractText.includes(marker)) {
    fail(`star view contract is missing marker: ${marker}`)
  }
})

const requiredBuilderMarkers = [
  "categoryLabel: STAR_CATEGORY_LABELS[star.category]",
  "placementRuleId: star.placementRuleId",
]

requiredBuilderMarkers.forEach((marker) => {
  if (!viewModelBuilderText.includes(marker)) {
    fail(`page view builder is missing marker: ${marker}`)
  }
})

const requiredComponentMarkers = [
  "showDetails?: boolean",
  "starDetailGrid",
  "starDetailCard",
  "庙旺落陷",
  "formatBrightnessLabel",
  "星曜 ID",
  "规则来源",
  "star.placementRuleId",
  "star.brightness",
  "star.categoryLabel",
]

requiredComponentMarkers.forEach((marker) => {
  if (!starGroupListText.includes(marker)) {
    fail(`star group list is missing marker: ${marker}`)
  }
})

if ((palaceDetailText.match(/showDetails/g) ?? []).length < 2) {
  fail("palace detail panel must enable detailed star cards for both star sections")
}

const requiredStyleMarkers = [
  ".starDetailGrid",
  ".starDetailCard",
  ".starDetailHeader",
  ".starMetaLine",
  ".brightnessBadge",
]

requiredStyleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`star detail style is missing marker: ${marker}`)
  }
})

const requiredDocMarkers = [
  "星曜明细",
  "庙旺落陷",
  "星曜 ID",
  "规则来源",
  "check-star-detail-view.mjs",
]

requiredDocMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page structure doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei star detail view check passed.")
