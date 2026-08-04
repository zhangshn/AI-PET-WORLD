import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const registryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-module-registry.ts",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const collapsiblePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "collapsible-module.tsx",
)
const navigationPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "module-navigation-panel.tsx",
)
const urlStatePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-url-state.ts",
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
const executionDocPath = path.join(root, "data", "ziwei", "legacy-execution-verification-baseline-v1.txt")

function fail(message) {
  console.error(`Ziwei module navigation check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  registryPath,
  clientPath,
  collapsiblePath,
  navigationPath,
  urlStatePath,
  stylePath,
  pageDocPath,
  directoryDocPath,
  executionDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const registryText = readFileSync(registryPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const collapsibleText = readFileSync(collapsiblePath, "utf8")
const navigationText = readFileSync(navigationPath, "utf8")
const urlStateText = readFileSync(urlStatePath, "utf8")
const styleText = readFileSync(stylePath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

const moduleIds = [
  "chart-meta",
  "view-share",
  "birth-input",
  "dynamic-tabs",
  "dynamic-overview",
  "chart-grid",
  "dynamic-focus",
  "dynamic-matrix",
  "dynamic-impact",
  "dynamic-priority",
  "palace-density",
  "brightness-matrix",
  "relation-matrix",
  "palace-overview",
  "palace-detail",
  "pattern-overview",
  "pattern-palace-summary",
  "pattern-statistics",
  "pattern-gaps",
  "pattern-source-index",
  "pattern-consistency",
  "misc-stars",
  "category-summary",
  "brightness-summary",
  "rule-source",
  "same-name-stars",
  "star-catalog",
  "debug-json",
]

moduleIds.forEach((moduleId) => {
  if (!registryText.includes(`id: "${moduleId}"`)) {
    fail(`registry is missing module id: ${moduleId}`)
  }

  if (!clientText.includes(`moduleId="${moduleId}"`)) {
    fail(`client page does not wrap module: ${moduleId}`)
  }
})

const registryMarkers = [
  "ZiweiPageModuleDefinition",
  "ZIWEI_PAGE_MODULES",
  "ZiweiPageModuleId",
  "buildDefaultCollapsedModuleIds",
  "defaultCollapsed",
]

registryMarkers.forEach((marker) => {
  if (!registryText.includes(marker)) {
    fail(`registry is missing marker: ${marker}`)
  }
})

const collapsibleMarkers = [
  "export function CollapsibleModule",
  "aria-expanded",
  "aria-controls",
  "ziwei-module-body",
  "props.collapsed ? null",
]

collapsibleMarkers.forEach((marker) => {
  if (!collapsibleText.includes(marker)) {
    fail(`collapsible component is missing marker: ${marker}`)
  }
})

const navigationMarkers = [
  "export function ModuleNavigationPanel",
  "COLUMN_ORDER",
  "const moduleId = module.id as ZiweiPageModuleId",
  "props.collapsedModuleIds.has(moduleId)",
  "props.onOpenModule(moduleId)",
  "props.onToggleModule(moduleId)",
]

navigationMarkers.forEach((marker) => {
  if (!navigationText.includes(marker)) {
    fail(`navigation component is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "collapsedModuleIds",
  "toggleModule",
  "openModule",
  "ModuleNavigationPanel",
  "CollapsibleModule",
  "scrollIntoView",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

if (!urlStateText.includes("buildDefaultCollapsedModuleIds")) {
  fail("URL state lib is missing default collapsed module source")
}

const styleMarkers = [
  ".moduleFrame",
  ".moduleToggle",
  ".moduleBody",
  ".moduleNavGrid",
  ".moduleNavButton",
  ".moduleNavMiniButton",
]

styleMarkers.forEach((marker) => {
  if (!styleText.includes(marker)) {
    fail(`style is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "collapsible-module.tsx",
  "module-navigation-panel.tsx",
  "ziwei-module-registry.ts",
  "check-module-navigation.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker)) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

if (!executionDocText.includes("| 53 |")) {
  fail("execution table is missing row 53")
}

console.log("Ziwei module navigation check passed.")
