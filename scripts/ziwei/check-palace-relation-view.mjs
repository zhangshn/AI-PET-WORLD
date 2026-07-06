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
const builderPath = path.join(
  root,
  "src",
  "ai",
  "destiny-core",
  "ziwei-core",
  "page-view",
  "page-view-model-builder.ts",
)
const componentPath = path.join(
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
  console.error(`Ziwei palace relation view check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  contractPath,
  builderPath,
  componentPath,
  stylePath,
  pageDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const contractText = readFileSync(contractPath, "utf8")
const builderText = readFileSync(builderPath, "utf8")
const componentText = readFileSync(componentPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")

const contractMarkers = [
  "export type ZiweiPalaceRelationKind",
  "export interface ZiweiPalaceRelationView",
  "relations: ZiweiPalaceRelationView[]",
  "kindLabel: string",
  "sectorLabel: string",
]

contractMarkers.forEach((marker) => {
  if (!contractText.includes(marker)) {
    fail(`contract is missing marker: ${marker}`)
  }
})

const builderMarkers = [
  "buildPalaceRelations",
  "buildPalaceRelation",
  "moveBranch(palace.branch, -1)",
  "moveBranch(palace.branch, 1)",
  "kindLabel: \"本宫\"",
  "kindLabel: \"对宫\"",
  "kindLabel: \"三方\"",
  "kindLabel: \"邻宫\"",
]

builderMarkers.forEach((marker) => {
  if (!builderText.includes(marker)) {
    fail(`view model builder is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "props.palace.relations.map",
  "relation.kindLabel",
  "relation.branchLabel",
  "relation.sectorLabel",
  "relation.note",
  "styles.relationGrid",
  "styles.relationCard",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`palace detail component is missing marker: ${marker}`)
  }
})

const forbiddenComponentMarkers = [
  "props.palace.oppositeBranchLabel",
  "props.palace.trineBranchLabels.join",
]

forbiddenComponentMarkers.forEach((marker) => {
  if (componentText.includes(marker)) {
    fail(`palace detail component still directly renders relation field: ${marker}`)
  }
})

const styleMarkers = [
  ".relationGrid",
  ".relationCard",
  ".relationHeader",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "宫位关系视图",
  "ZiweiPalaceRelationView",
  "check-palace-relation-view.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei palace relation view check passed.")
