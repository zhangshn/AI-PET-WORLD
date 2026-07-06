import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "palace-relation-matrix-panel.tsx",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const matrixPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-relation-matrix.ts",
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
const directoryDocPath = path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md")

function fail(message) {
  console.error(`Ziwei palace relation matrix panel check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  componentPath,
  clientPath,
  matrixPath,
  stylePath,
  pageDocPath,
  directoryDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const componentText = readFileSync(componentPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const matrixText = readFileSync(matrixPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")

const matrixMarkers = [
  "ZiweiRelationMatrixTarget",
  "ZiweiRelationMatrixRow",
  "buildRelationMatrixRows",
  "relation.kind !== \"self\"",
  "note: relation.note",
  "countRelatedSourceRules",
  "countSourceRules",
  "countStars",
]

matrixMarkers.forEach((marker) => {
  if (!matrixText.includes(marker)) {
    fail(`relation matrix lib is missing marker: ${marker}`)
  }
})

const componentMarkers = [
  "export function PalaceRelationMatrixPanel",
  "三方四正关系矩阵",
  "buildRelationMatrixRows",
  "row.relatedStarCount",
  "target.sourceRuleCount",
  "target.note",
  "props.onSelect(target.branch)",
]

componentMarkers.forEach((marker) => {
  if (!componentText.includes(marker)) {
    fail(`relation matrix component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "PalaceRelationMatrixPanel",
  "palaces={viewModel.palaceDetails}",
  "selectedBranch={selectedBranch}",
  "onSelect={setSelectedBranch}",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

const styleMarkers = [
  ".relationMatrixGrid",
  ".relationMatrixCard",
  ".relationMatrixCardSelected",
  ".relationMatrixTarget",
  ".relationMatrixTarget small",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "三方四正关系矩阵",
  "palace-relation-matrix-panel.tsx",
  "ziwei-relation-matrix.ts",
  "check-palace-relation-matrix-panel.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker) && marker.endsWith(".tsx")) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

console.log("Ziwei palace relation matrix panel check passed.")
