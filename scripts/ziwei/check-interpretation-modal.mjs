import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

const files = {
  modal: path.join(root, "src/app/ziwei/_components/interpretation-modal.tsx"),
  clientPage: path.join(root, "src/app/ziwei/_components/ziwei-client-page.tsx"),
  chartGrid: path.join(root, "src/app/ziwei/_components/ziwei-chart-grid.tsx"),
  moduleRegistry: path.join(root, "src/app/ziwei/_lib/ziwei-module-registry.ts"),
  styles: path.join(root, "src/app/ziwei/_styles/ziwei-page.module.css"),
  pageStructure: path.join(root, "docs/ziwei/PAGE_ACCEPTANCE.md"),
  executionTable: path.join(root, "docs/ziwei/EXECUTION_TABLE.md")
}

function fail(message) {
  console.error(`[check-interpretation-modal] ${message}`)
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

function requireExcludes(text, markers, label) {
  const found = markers.filter((marker) => text.includes(marker))

  if (found.length > 0) {
    fail(`${label} should not include markers: ${found.join(", ")}`)
  }
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, read(file)])
)

requireIncludes(
  texts.modal,
  [
    "InterpretationModal",
    "role=\"dialog\"",
    "盘面分析",
    "InterpretationPanel",
    "dictionaryBodySingle"
  ],
  "interpretation-modal.tsx"
)
requireIncludes(
  texts.clientPage,
  [
    "interpretationOpen",
    "InterpretationModal",
    "open={interpretationOpen}"
  ],
  "ziwei-client-page.tsx"
)
requireExcludes(
  texts.clientPage,
  ["moduleId=\"interpretation\"", "getModuleLabel(\"interpretation\")"],
  "ziwei-client-page.tsx"
)
requireExcludes(
  texts.moduleRegistry,
  ["id: \"interpretation\""],
  "ziwei-module-registry.ts"
)
requireIncludes(
  texts.chartGrid,
  ["onOpenInterpretation", "盘面分析", "panelHeaderActions"],
  "ziwei-chart-grid.tsx"
)
requireIncludes(
  texts.styles,
  [".panelHeaderActions", ".dictionaryBodySingle"],
  "ziwei-page.module.css"
)
requireIncludes(
  texts.pageStructure,
  ["盘面分析弹层", "InterpretationModal", "dictionaryBodySingle"],
  "PAGE_ACCEPTANCE.md"
)
requireIncludes(
  texts.executionTable,
  ["盘面分析弹层", "check-interpretation-modal.mjs"],
  "EXECUTION_TABLE.md"
)

console.log("[check-interpretation-modal] ok")
