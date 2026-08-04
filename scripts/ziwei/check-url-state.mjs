import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const urlStatePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-url-state.ts",
)
const categoryFilterPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-star-category-filter.ts",
)
const brightnessSummaryPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-star-brightness-summary.ts",
)
const patternFilterPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-pattern-filter.ts",
)
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx",
)
const starCatalogPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "star-catalog-table.tsx",
)
const pageDocPath = path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md")
const pagePath = path.join(root, "src", "app", "ziwei", "page.tsx")
const directoryDocPath = path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md")
const executionDocPath = path.join(root, "data", "ziwei", "legacy-execution-verification-baseline-v1.txt")

function fail(message) {
  console.error(`Ziwei URL state check failed: ${message}`)
  process.exit(1)
}

for (const filePath of [
  urlStatePath,
  categoryFilterPath,
  brightnessSummaryPath,
  patternFilterPath,
  clientPath,
  pagePath,
  starCatalogPath,
  pageDocPath,
  directoryDocPath,
  executionDocPath,
]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const urlStateText = readFileSync(urlStatePath, "utf8")
const categoryFilterText = readFileSync(categoryFilterPath, "utf8")
const brightnessSummaryText = readFileSync(brightnessSummaryPath, "utf8")
const patternFilterText = readFileSync(patternFilterPath, "utf8")
const clientText = readFileSync(clientPath, "utf8")
const pageText = readFileSync(pagePath, "utf8")
const starCatalogText = readFileSync(starCatalogPath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const directoryDocText = readFileSync(directoryDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

const urlStateMarkers = [
  "ZIWEI_PAGE_URL_QUERY_KEYS",
  "palace: \"palace\"",
  "flow: \"flow\"",
  "category: \"category\"",
  "brightness: \"brightness\"",
  "pattern: \"pattern\"",
  "openModules: \"open\"",
  "closedModules: \"closed\"",
  "readZiweiPageUrlState",
  "buildZiweiPageUrlSearch",
  "readCollapsedModuleIds",
  "buildDefaultCollapsedModuleIds",
  "pickAllowedValue",
  "writeCsvParam",
  "selectedPatternFilter",
]

urlStateMarkers.forEach((marker) => {
  if (!urlStateText.includes(marker)) {
    fail(`URL state lib is missing marker: ${marker}`)
  }
})

const categoryFilterMarkers = [
  "export type StarCatalogCategoryFilter",
  "ZiweiStarCategory | \"all\"",
  "buildStarCatalogCategoryFilterValues",
]

categoryFilterMarkers.forEach((marker) => {
  if (!categoryFilterText.includes(marker)) {
    fail(`category filter lib is missing marker: ${marker}`)
  }
})

const brightnessFilterMarkers = [
  "export type StarCatalogBrightnessFilter",
  "buildStarCatalogBrightnessFilterValues",
  "getStarBrightnessFilterLabel",
]

brightnessFilterMarkers.forEach((marker) => {
  if (!brightnessSummaryText.includes(marker)) {
    fail(`brightness summary lib is missing marker: ${marker}`)
  }
})

const patternFilterMarkers = [
  "export type PatternFilterValue",
  "buildPatternFilterValues",
  "getPatternFilterLabel",
  "category:${ZiweiPatternCategory}",
]

patternFilterMarkers.forEach((marker) => {
  if (!patternFilterText.includes(marker)) {
    fail(`pattern filter lib is missing marker: ${marker}`)
  }
})

const clientMarkers = [
  "initialSearchParams: Record<string, string>",
  "buildInitialUrlState",
  "readZiweiPageUrlState",
  "buildZiweiPageUrlSearch",
  "buildStarCatalogCategoryFilterValues",
  "buildStarCatalogBrightnessFilterValues",
  "buildPatternFilterValues",
  "selectedStarBrightness",
  "selectedPatternFilter",
  "window.history.replaceState",
  "new URLSearchParams(window.location.search)",
  "const selectedFlowType = urlState.selectedFlowType ?? \"natal\"",
  "selectedFlow?.palace",
]

clientMarkers.forEach((marker) => {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
})

if (starCatalogText.includes("export type StarCatalogCategoryFilter")) {
  fail("star catalog table still defines StarCatalogCategoryFilter locally")
}

if (clientText.includes("const selectedFlowType: ZiweiDynamicFlowType = \"natal\"")) {
  fail("initial URL state still ignores the flow query")
}

const pageMarkers = [
  "searchParams?: Promise<ZiweiPageSearchParams>",
  "normalizeSearchParams",
  "initialSearchParams={initialSearchParams}",
]

pageMarkers.forEach((marker) => {
  if (!pageText.includes(marker)) {
    fail(`page is missing marker: ${marker}`)
  }
})

const docMarkers = [
  "ziwei-url-state.ts",
  "ziwei-star-category-filter.ts",
  "ziwei-star-brightness-summary.ts",
  "ziwei-pattern-filter.ts",
  "check-url-state.mjs",
]

docMarkers.forEach((marker) => {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }

  if (!directoryDocText.includes(marker)) {
    fail(`directory doc is missing marker: ${marker}`)
  }
})

if (!executionDocText.includes("| 54 |") || !executionDocText.includes("| 73 |")) {
  fail("execution table is missing row 54 or row 73")
}

console.log("Ziwei URL state check passed.")
