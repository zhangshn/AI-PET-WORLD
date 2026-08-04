import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const require = createRequire(import.meta.url)

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText

  module._compile(output, filename)
}

const files = {
  contract: path.join(
    root,
    "src/ai/destiny-core/ziwei-core/contracts/page-view-contract.ts"
  ),
  contractIndex: path.join(
    root,
    "src/ai/destiny-core/ziwei-core/contracts/index.ts"
  ),
  builder: path.join(
    root,
    "src/ai/destiny-core/ziwei-core/page-view/page-view-model-builder.ts"
  ),
  modal: path.join(root, "src/app/ziwei/_components/star-dictionary-modal.tsx"),
  clientPage: path.join(root, "src/app/ziwei/_components/ziwei-client-page.tsx"),
  chartGrid: path.join(root, "src/app/ziwei/_components/ziwei-chart-grid.tsx"),
  styles: path.join(root, "src/app/ziwei/_styles/ziwei-page.module.css"),
  pageStructure: path.join(root, "docs/ziwei/PAGE_ACCEPTANCE.md"),
  executionTable: path.join(root, "data/ziwei/legacy-execution-verification-baseline-v1.txt")
}

function fail(message) {
  console.error(`[check-star-dictionary-modal] ${message}`)
  process.exit(1)
}

function read(file) {
  if (!existsSync(file)) {
    fail(`missing file: ${path.relative(root, file)}`)
  }

  return readFileSync(file, "utf8")
}

function requireIncludes(text, markers, label) {
  const missing = markers.filter((marker) => !text.includes(marker))

  if (missing.length > 0) {
    fail(`${label} missing markers: ${missing.join(", ")}`)
  }
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, read(file)])
)

requireIncludes(
  texts.contract,
  [
    "ZiweiStarDictionaryEntryView",
    "ZiweiStarDictionaryDetailView",
    "sourceLabel",
    "extendedOverview",
    "extendedSections",
    "symbolicMeanings",
    "interpretationSteps",
    "starDictionaryEntries: ZiweiStarDictionaryEntryView[]"
  ],
  "page-view-contract.ts"
)
requireIncludes(
  texts.contractIndex,
  [
    "ZiweiStarDictionaryDetailView",
    "ZiweiStarDictionaryEntryView",
    "ZiweiStarDictionaryPlacementView"
  ],
  "contracts/index.ts"
)
requireIncludes(
  texts.builder,
  [
    "buildStarDictionaryEntries",
    "ziweiStarCatalog",
    "buildZiweiStarContentDictionaryDetail",
    "getZiweiStarInterpretationProfile",
    "starDictionaryEntries: buildStarDictionaryEntries"
  ],
  "page-view-model-builder.ts"
)
requireIncludes(
  texts.modal,
  [
    "StarDictionaryModal",
    "DictionaryMode",
    "DICTIONARY_MODE_OPTIONS",
    "selectedMode",
    "setSelectedMode",
    "role=\"dialog\"",
    "星曜数据字典",
    "星曜本体",
    "入宫解释",
    "组合解释",
    "读盘边界",
    "盘中位置",
    "星曜本体解释",
    "星曜入宫解释规则",
    "星曜组合解释规则",
    "整盘解释边界",
    "当前盘中出现位置",
    "dictionaryLongSection",
    "dictionaryModeTabs",
    "dictionaryModeTabActive",
    "资料来源",
    "通用象义",
    "读盘步骤",
    "entry.detail",
    "entry.detail.sourceLabel"
  ],
  "star-dictionary-modal.tsx"
)
requireIncludes(
  texts.clientPage,
  [
    "starDictionaryOpen",
    "StarDictionaryModal",
    "entries={viewModel.starDictionaryEntries}"
  ],
  "ziwei-client-page.tsx"
)
requireIncludes(
  texts.chartGrid,
  ["onOpenStarDictionary", "星曜字典"],
  "ziwei-chart-grid.tsx"
)
requireIncludes(
  texts.styles,
  [
    ".dictionaryOverlay",
    ".dictionaryDialog",
    ".dictionaryModeTabs",
    ".dictionaryModeTab",
    ".dictionaryModeTabActive",
    ".dictionaryCard",
    ".dictionarySection",
    ".dictionaryLongText",
    ".dictionaryLongSection"
  ],
  "ziwei-page.module.css"
)
requireIncludes(
  texts.pageStructure,
  ["星曜字典", "StarDictionaryModal", "starDictionaryEntries"],
  "PAGE_ACCEPTANCE.md"
)
requireIncludes(
  texts.executionTable,
  ["星曜字典弹层", "check-star-dictionary-modal.mjs"],
  "EXECUTION_TABLE.md"
)

const {
  buildFullZiweiChart,
  buildZiweiPageViewModel
} = require(path.join(root, "src/ai/destiny-core/ziwei-core/public-api"))
const {
  ziweiStarCatalog
} = require(path.join(root, "src/ai/destiny-core/ziwei-core/star-catalog"))

const chart = buildFullZiweiChart({
  name: "star-dictionary-check",
  calendarType: "solar",
  year: 1990,
  month: 5,
  day: 17,
  hour: 7,
  minute: 30,
  gender: "male"
})
const viewModel = buildZiweiPageViewModel({ chart })

if (viewModel.starDictionaryEntries.length !== ziweiStarCatalog.length) {
  fail(
    `dictionary count mismatch: ${viewModel.starDictionaryEntries.length} !== ${ziweiStarCatalog.length}`
  )
}

if (!viewModel.starDictionaryEntries.every((entry) => entry.summary.length > 0)) {
  fail("every dictionary entry must have a summary")
}

if (!viewModel.starDictionaryEntries.every((entry) => entry.detail)) {
  fail("every dictionary entry must have detailed content")
}

viewModel.starDictionaryEntries.forEach((entry) => {
  if ((entry.detail?.extendedOverview.length ?? 0) < 80) {
    fail(`${entry.starId}: extended overview is too short`)
  }

  if ((entry.detail?.extendedSections.length ?? 0) < 10) {
    fail(`${entry.starId}: extended sections are incomplete`)
  }
})

if (
  viewModel.starDictionaryEntries.some((entry) => {
    return entry.detail?.sourceLabel === "分类兜底"
  })
) {
  fail("dictionary entries should not use category fallback after periodic refinement")
}

console.log("[check-star-dictionary-modal] ok")
