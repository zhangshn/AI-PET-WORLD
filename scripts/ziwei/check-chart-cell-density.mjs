import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..", "..")

const files = {
  chartGrid: path.join(root, "src", "app", "ziwei", "_components", "ziwei-chart-grid.tsx"),
  starGroupList: path.join(root, "src", "app", "ziwei", "_components", "star-group-list.tsx"),
  flowDepth: path.join(root, "src", "app", "ziwei", "_lib", "ziwei-dynamic-flow-depth.ts"),
  styles: path.join(root, "src", "app", "ziwei", "_styles", "ziwei-page.module.css"),
  pageStructure: path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md"),
  executionTable: path.join(root, "docs", "ziwei", "EXECUTION_TABLE.md")
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")])
)

function fail(message) {
  console.error(`[check-chart-cell-density] ${message}`)
  process.exit(1)
}

function requireIncludes(text, marker, label) {
  if (!text.includes(marker)) {
    fail(`${label} is missing marker: ${marker}`)
  }
}

const starGroupMarkers = [
  "compactGroupLimit?: number",
  "compactStarLimit?: number",
  "dense?: boolean",
  "mixedOrientation?: boolean",
  "props.compactGroupLimit ?? 3",
  "props.compactStarLimit ?? 3",
  "styles.starGroupsDense",
  "isHorizontalStarGroup",
  "getStarGroupCategoryClassName",
  "styles.starGroupMain",
  "styles.starGroupMalefic",
  "styles.starGroupHorizontal",
  "styles.starGroupVertical"
]

for (const marker of starGroupMarkers) {
  requireIncludes(texts.starGroupList, marker, "star-group-list.tsx")
}

const chartMarkers = [
  "countPalaceStars",
  "countPalaceBrightStars",
  "patternPalaceRows",
  "selectedPatternRow",
  "dynamicDebug",
  "dynamicFlows",
  "palaceDetails",
  "buildDaYunRangesByBranch",
  "daYunRangesByBranch",
  "buildDynamicMarkersByBranch",
  "centerDynamicFlows",
  "isZiweiDynamicFlowWithinSelectedDepth",
  "flow.type === \"natal\"",
  "buildRelationLines",
  "chartRelationOverlay",
  "getRelationLineToneClassName",
  "hasPalaceTimeLayer",
  "palaceTimeLayer",
  "palaceStaticMarkers",
  "DYNAMIC_SECTOR_MARKER_DISPLAY_LIMIT",
  "DYNAMIC_STAR_DISPLAY_LIMIT",
  "hiddenDynamicStarCount",
  "hiddenDynamicSectorMarkerCount",
  "dynamicOverflowMarker",
  "compareSelectedDynamicStars",
  "getDynamicStarKindClassName",
  "getDynamicPalaceMarkerToneClassName",
  "PalaceStarBoard",
  "PalaceStarRow",
  "getStarsByCategories",
  "styles.palaceStarBoard",
  "styles.palaceStarRowMain",
  "styles.palaceStarRowAssistant",
  "styles.palaceStarRowPressure",
  "styles.palaceStarRowMisc",
  "styles.palaceStarRowFlow",
  "styles.palaceStarToken",
  "styles.palaceCellContent",
  "styles.palaceFlowLines",
  "styles.palaceBottom",
  "styles.palacePatternWarning",
  "styles.palacePatternAdverse"
]

for (const marker of chartMarkers) {
  requireIncludes(texts.chartGrid, marker, "ziwei-chart-grid.tsx")
}

const styleMarkers = [
  "grid-template-rows: repeat(4, minmax(248px, auto));",
  ".palaceCellContent",
  ".palaceStarBoard",
  ".palaceStarRowMain",
  ".palaceStarRowAssistant",
  ".palaceStarRowPressure",
  ".palaceStarRowMisc",
  ".palaceStarRowFlow",
  ".palaceStarTokenMain",
  ".palaceStarTokenAssistant",
  ".palaceStarTokenPressure",
  ".palaceStarTokenMisc",
  ".palaceStarTokenFlow",
  ".palaceFlowLines",
  ".palaceBottom",
  ".palacePatternWarning",
  ".palacePatternAdverse",
  ".palaceTimeLayer",
  ".palaceStaticMarkers",
  ".dynamicOverflowMarker",
  ".dynamicStarTransformation",
  ".dynamicStarAnnualCycle",
  ".dynamicPalaceMarker",
  ".dynamicPalaceMarkerLiuNian",
  ".dynamicPalaceMarkerLiuYue",
  ".dynamicPalaceMarkerLiuRi",
  ".dynamicPalaceMarkerActive",
  ".chartRelationOverlay",
  ".chartRelationLineLiuNian",
  ".chartRelationLineTrine",
  ".starGroupsDense",
  ".starListHorizontal",
  ".starListVertical",
  ".starGroupsDense .starGroupHorizontal",
  ".starGroupsDense .starGroupVertical",
  ".starGroupsDense .starPill",
  ".starGroupMain .starPill",
  ".starGroupMalefic .starPill",
  ".palaceTimeLayer .dynamicPalaceMarker"
]

for (const marker of styleMarkers) {
  requireIncludes(texts.styles, marker, "ziwei-page.module.css")
}

for (const marker of [
  "ZIWEI_DYNAMIC_FLOW_DEPTH",
  "isZiweiDynamicFlowWithinSelectedDepth",
  "liuShi: 5"
]) {
  requireIncludes(texts.flowDepth, marker, "ziwei-dynamic-flow-depth.ts")
}

const docMarkers = [
  "宫格密度规则",
  "宫格直接显示格局指标条",
  "宫格主盘完整展示本宫星曜",
  "不得用 +N 折叠主盘星曜",
  "主星和杂曜在宫格中横向排列",
  "动态命宫标记",
  "三方四正动态线条",
  "| 61 | P13 | 首屏十二宫宫格内容密度整改",
  "| 81 | P13 | 格局与十二宫盘联动强化",
  "| 111 | P17 | 流动时间盘下移与宫格紧缩",
  "| 117 | P18 | 十二宫主盘动态命宫标记",
  "| 119 | P18 | 十二宫主盘三方四正动态线条"
]

for (const marker of docMarkers) {
  const text =
    marker.startsWith("| 61 |") ||
    marker.startsWith("| 81 |") ||
    marker.startsWith("| 111 |") ||
    marker.startsWith("| 117 |") ||
    marker.startsWith("| 119 |")
      ? texts.executionTable
      : texts.pageStructure
  requireIncludes(text, marker, "ziwei docs")
}

console.log("[check-chart-cell-density] ok")
