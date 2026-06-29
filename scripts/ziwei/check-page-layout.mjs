import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const require = createRequire(import.meta.url)
const layoutPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_lib",
  "ziwei-palace-layout.ts",
)
const componentPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-chart-grid.tsx",
)
const stylePath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_styles",
  "ziwei-page.module.css",
)

require.extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    }
  }).outputText

  module._compile(output, filename)
}

function fail(message) {
  console.error(`Ziwei page layout check failed: ${message}`)
  process.exit(1)
}

if (!existsSync(layoutPath)) {
  fail("ziwei-palace-layout.ts is missing")
}

if (!existsSync(componentPath)) {
  fail("ziwei-chart-grid.tsx is missing")
}

if (!existsSync(stylePath)) {
  fail("ziwei-page.module.css is missing")
}

const {
  ZIWEI_DESKTOP_GRID_TEMPLATE_ROWS,
  ZIWEI_MOBILE_GRID_TEMPLATE_ROWS,
  ZIWEI_PALACE_GRID_AREA_BY_BRANCH
} = require(layoutPath)
const componentText = readFileSync(componentPath, "utf8")
const styleText = readFileSync(stylePath, "utf8")

const expectedBranches = [
  "si",
  "wu",
  "wei",
  "shen",
  "chen",
  "you",
  "mao",
  "xu",
  "yin",
  "chou",
  "zi",
  "hai",
]

expectedBranches.forEach((branch) => {
  if (ZIWEI_PALACE_GRID_AREA_BY_BRANCH[branch] !== branch) {
    fail(`layout source has invalid grid area for ${branch}`)
  }
})

if (!styleText.includes("var(--ziwei-desktop-grid-areas)")) {
  fail("desktop grid does not read the shared CSS variable")
}

if (!styleText.includes("var(--ziwei-mobile-grid-areas)")) {
  fail("mobile grid does not read the shared CSS variable")
}

ZIWEI_DESKTOP_GRID_TEMPLATE_ROWS.forEach((row) => {
  if (!componentText.includes("ZIWEI_DESKTOP_GRID_TEMPLATE_ROWS")) {
    fail("component does not import desktop layout rows")
  }

  if (!row.includes("center") && row.split(" ").length !== 4) {
    fail(`desktop layout row is invalid: ${row}`)
  }
})

ZIWEI_MOBILE_GRID_TEMPLATE_ROWS.forEach((row) => {
  if (!componentText.includes("ZIWEI_MOBILE_GRID_TEMPLATE_ROWS")) {
    fail("component does not import mobile layout rows")
  }

  if (row.includes(" ")) {
    fail(`mobile layout row should be single-column: ${row}`)
  }
})

if (!componentText.includes("getZiweiPalaceGridArea(palace.branch)")) {
  fail("component does not use the shared palace layout source")
}

if (!componentText.includes("chartMeta: ZiweiChartMetaView")) {
  fail("chart grid does not receive chart metadata")
}

if (!componentText.includes("totalStarCount: number")) {
  fail("chart grid does not receive total star count")
}

if (!componentText.includes("props.chartMeta.inputSummary")) {
  fail("center palace does not display input summary")
}

if (!componentText.includes("props.chartMeta.ruleSetVersion")) {
  fail("center palace does not display rule set version")
}

if (!componentText.includes("props.totalStarCount")) {
  fail("center palace does not display total star count")
}

if (!componentText.includes(">中宫<")) {
  fail("chart center label is missing")
}

if (!styleText.includes("grid-area: center")) {
  fail("center grid area is missing")
}

console.log("Ziwei page layout check passed.")
