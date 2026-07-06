import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const clientPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "ziwei-client-page.tsx"
)
const overviewPath = path.join(
  root,
  "src",
  "app",
  "ziwei",
  "_components",
  "pattern-overview-panel.tsx"
)
const pageDocPath = path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md")
const executionDocPath = path.join(root, "docs", "ziwei", "EXECUTION_TABLE.md")

function fail(message) {
  console.error(`[check-dynamic-pattern-scope] ${message}`)
  process.exit(1)
}

for (const filePath of [clientPath, overviewPath, pageDocPath, executionDocPath]) {
  if (!existsSync(filePath)) {
    fail(`missing file: ${path.relative(root, filePath)}`)
  }
}

const clientText = readFileSync(clientPath, "utf8")
const overviewText = readFileSync(overviewPath, "utf8")
const pageDocText = readFileSync(pageDocPath, "utf8")
const executionDocText = readFileSync(executionDocPath, "utf8")

for (const marker of [
  "patternPalaces",
  "buildCurrentFlowPatternPalaces",
  "selectedFlow: selectedDynamicFlowDetail",
  "isLifePalace = palace.branch === lifeBranch",
  "matches: buildZiweiPatternMatches(patternPalaces)",
  "palaces={patternPalaces}",
  "scopeLabel={selectedDynamicFlowDetail.label}",
  "<PatternPalaceSummaryPanel",
  "<PatternStatisticsPanel",
  "<PatternGapPanel",
  "<PatternSourceIndexPanel",
  "<PatternConsistencyPanel"
]) {
  if (!clientText.includes(marker)) {
    fail(`client page is missing marker: ${marker}`)
  }
}

if (clientText.includes("matches: buildZiweiPatternMatches(viewModel.palaceDetails)")) {
  fail("pattern palace summary should not use natal-only palace details")
}

for (const marker of [
  "scopeLabel: string",
  "{formatPatternScopeLabel(props.scopeLabel)} · {summary.hitCount} 命中",
  "原盘格局",
  "`${scopeLabel}格局`"
]) {
  if (!overviewText.includes(marker)) {
    fail(`pattern overview panel is missing marker: ${marker}`)
  }
}

for (const marker of [
  "格局展示动态流视角",
  "当前流命宫",
  "buildCurrentFlowPatternPalaces"
]) {
  if (!pageDocText.includes(marker)) {
    fail(`page doc is missing marker: ${marker}`)
  }
}

if (!executionDocText.includes("| 123 | P18 | 动态流格局视角切换")) {
  fail("execution table is missing P18-123 row")
}

console.log("[check-dynamic-pattern-scope] ok")
