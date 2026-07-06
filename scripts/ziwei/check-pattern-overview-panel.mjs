import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, "..", "..")

const files = {
  patternCatalog: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-catalog.ts"
  ),
  patternPanel: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_components",
    "pattern-overview-panel.tsx"
  ),
  patternExplanation: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-explanation.ts"
  ),
  patternDetailedAnalysis: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-detailed-analysis.ts"
  ),
  patternSourceIndex: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-source-index.ts"
  ),
  patternFilter: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-filter.ts"
  ),
  patternGaps: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-gaps.ts"
  ),
  patternStatistics: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-statistics.ts"
  ),
  patternExportSummary: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-export-summary.ts"
  ),
  patternPriority: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-priority.ts"
  ),
  patternPalaceSummary: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-palace-summary.ts"
  ),
  patternConsistency: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-consistency.ts"
  ),
  patternSourcePanel: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_components",
    "pattern-source-index-panel.tsx"
  ),
  patternGapPanel: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_components",
    "pattern-gap-panel.tsx"
  ),
  patternStatisticsPanel: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_components",
    "pattern-statistics-panel.tsx"
  ),
  patternPalaceSummaryPanel: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_components",
    "pattern-palace-summary-panel.tsx"
  ),
  patternConsistencyPanel: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_components",
    "pattern-consistency-panel.tsx"
  ),
  clientPage: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_components",
    "ziwei-client-page.tsx"
  ),
  registry: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-module-registry.ts"
  ),
  styles: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_styles",
    "ziwei-page.module.css"
  ),
  pageDoc: path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md"),
  directoryDoc: path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md"),
  executionDoc: path.join(root, "docs", "ziwei", "EXECUTION_TABLE.md")
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, "utf8")])
)

function fail(message) {
  console.error(`[check-pattern-overview-panel] ${message}`)
  process.exit(1)
}

function requireIncludes(text, marker, label) {
  if (!text.includes(marker)) {
    fail(`${label} is missing marker: ${marker}`)
  }
}

const catalogMarkers = [
  "ZIWEI_PATTERN_DEFINITIONS",
  "pattern.literary.wenchang-wenqu-arch-life",
  "文星拱命格",
  "昌曲同宫格",
  "昌曲庙旺会命格",
  "左右会命格",
  "魁钺会命格",
  "紫府同宫格",
  "紫微守命格",
  "紫微庙旺守命格",
  "紫微庙旺加吉格",
  "天府守命格",
  "天府庙旺守命格",
  "天府庙旺加吉格",
  "天相守命格",
  "天相庙旺加吉格",
  "太阳守命格",
  "太阳庙旺守命格",
  "太阳庙旺加吉格",
  "太阴守命格",
  "太阴庙旺守命格",
  "太阴庙旺加吉格",
  "武曲守命格",
  "武曲庙旺守命格",
  "武曲庙旺加吉格",
  "府相夹命格",
  "府相庙旺朝垣格",
  "日月夹命格",
  "紫相会命格",
  "紫杀会命格",
  "机月同梁格",
  "杀破狼格",
  "日月庙旺并明格",
  "三奇嘉会格",
  "禄权会命格",
  "禄科会命格",
  "权科会命格",
  "双禄会命格",
  "pattern.wealth.four-transformations-life",
  "pattern.wealth.lu-quan-same-palace",
  "pattern.wealth.lu-ke-same-palace",
  "pattern.wealth.quan-ke-same-palace",
  "pattern.wealth.san-qi-same-palace",
  "pattern.wealth.double-lu-same-palace",
  "火贪格",
  "same-palace-all-in-branches",
  "star-branches",
  "火铃贪格",
  "阳梁昌禄格",
  "日照雷门格",
  "月朗天门格",
  "明珠出海格",
  "财荫夹印格",
  "刑囚夹印格",
  "铃昌陀武格",
  "马头带箭格",
  "凶格破格",
  "pattern.adverse.qing-yang-life",
  "pattern.misc.tai-fu-feng-gao-life",
  "pattern.misc.long-chi-feng-ge-life",
  "pattern.misc.san-tai-ba-zuo-life",
  "pattern.misc.en-guang-tian-gui-life",
  "pattern.misc.hong-luan-tian-xi-life",
  "pattern.misc.xian-chi-tian-yao-life",
  "pattern.adverse.gu-chen-gua-su-life-scope",
  "pattern.assistant.fu-bi-chang-qu-life",
  "pattern.assistant.fu-bi-kui-yue-life",
  "pattern.literary.chang-qu-kui-yue-life",
  "pattern.wealth.lu-ma-pei-yin",
  "pattern.wealth.fu-lu-ma-life",
  "pattern.wealth.ma-lu-quan-life",
  "pattern.main.tianji-life",
  "pattern.main.tianji-bright-life",
  "pattern.main.tiantong-life",
  "pattern.main.tiantong-bright-life",
  "pattern.main.lianzhen-life",
  "pattern.main.lianzhen-bright-life",
  "pattern.main.tianliang-life",
  "pattern.main.tianliang-bright-life",
  "pattern.main.qisha-life",
  "pattern.main.qisha-bright-life",
  "pattern.main.pojun-life",
  "pattern.main.pojun-bright-life",
  "pattern.main.tanlang-life",
  "pattern.main.tanlang-bright-life",
  "pattern.main.jumen-life",
  "pattern.main.jumen-bright-life",
  "pattern.main.zi-tan-same-palace",
  "pattern.main.zi-po-same-palace",
  "pattern.main.zi-sha-same-palace",
  "pattern.main.wu-fu-same-palace",
  "pattern.main.wu-xiang-same-palace",
  "pattern.main.wu-tan-same-palace",
  "pattern.main.lian-sha-same-palace",
  "pattern.main.lian-po-same-palace",
  "pattern.main.lian-tan-same-palace",
  "pattern.main.ji-ju-same-palace",
  "pattern.main.ji-liang-same-palace",
  "pattern.main.ji-yin-same-palace",
  "pattern.main.tong-yin-same-palace",
  "pattern.assistant.six-auspicious-life-scope",
  "pattern.assistant.six-auspicious-full-life",
  "pattern.assistant.ziwei-zuo-you-adjacent-life",
  "pattern.assistant.tianfu-zuo-you-adjacent-life",
  "pattern.assistant.tianxiang-zuo-you-adjacent-life",
  "pattern.literary.taiyang-chang-qu-adjacent-life",
  "pattern.literary.taiyin-chang-qu-adjacent-life",
  "pattern.literary.tianliang-chang-qu-adjacent-life",
  "pattern.assistant.wuqu-kui-yue-adjacent-life",
  "pattern.wealth.lu-ma-adjacent-life",
  "pattern.wealth.lu-quan-adjacent-life",
  "pattern.wealth.lu-ke-adjacent-life",
  "pattern.wealth.quan-ke-adjacent-life",
  "pattern.wealth.double-lu-adjacent-life",
  "擎羊守命格",
  "陀罗守命格",
  "火星守命格",
  "铃星守命格",
  "羊陀会命格",
  "火铃会命格",
  "空劫会命格",
  "四煞会命格",
  "六煞会命格",
  "煞忌交冲命格",
  "化忌会命格",
  "pattern.adverse.lu-ji-life-scope",
  "pattern.adverse.quan-ji-life-scope",
  "pattern.adverse.ke-ji-life-scope",
  "pattern.adverse.lu-ji-same-palace",
  "pattern.adverse.quan-ji-same-palace",
  "pattern.adverse.ke-ji-same-palace",
  "pattern.adverse.lu-ji-adjacent-life",
  "pattern.adverse.quan-ji-adjacent-life",
  "pattern.adverse.ke-ji-adjacent-life",
  "羊火同宫格",
  "羊铃同宫格",
  "陀火同宫格",
  "陀铃同宫格",
  "火铃同宫格",
  "空劫同宫格",
  "空劫化忌会命格",
  "羊忌同宫格",
  "陀忌同宫格",
  "火忌同宫格",
  "铃忌同宫格",
  "空忌同宫格",
  "劫忌同宫格",
  "巨门化忌同宫格",
  "廉贞化忌同宫格",
  "武曲化忌同宫格",
  "天机化忌同宫格",
  "太阳化忌同宫格",
  "太阴化忌同宫格",
  "贪狼化忌同宫格",
  "破军化忌同宫格",
  "巨门遇煞忌格",
  "廉贞遇煞忌格",
  "武曲遇煞忌格",
  "七杀遇煞忌格",
  "破军遇煞忌格",
  "贪狼遇煞忌格",
  "pattern.adverse.ziwei-malefic-ji-life",
  "pattern.adverse.tianfu-malefic-ji-life",
  "pattern.adverse.tianxiang-malefic-ji-life",
  "pattern.adverse.tianji-malefic-ji-life",
  "pattern.adverse.tiantong-malefic-ji-life",
  "pattern.adverse.tianliang-malefic-ji-life",
  "pattern.adverse.taiyang-malefic-ji-life",
  "pattern.adverse.taiyin-malefic-ji-life",
  "pattern.adverse.romance-life-scope",
  "pattern.adverse.romance-malefic-life-scope",
  "pattern.adverse.xian-chi-hua-ji-same-palace",
  "pattern.adverse.tian-yao-hua-ji-same-palace",
  "pattern.adverse.solitary-malefic-life-scope",
  "pattern.adverse.hong-luan-hua-ji-same-palace",
  "pattern.adverse.tian-xi-hua-ji-same-palace",
  "pattern.main.ziwei-zi-wu-clean-life",
  "pattern.main.tianfu-chou-wei-clean-life",
  "pattern.main.taiyang-mao-clean-life",
  "pattern.main.taiyin-hai-clean-life",
  "pattern.main.wuqu-chen-xu-clean-life",
  "pattern.main.tianliang-wu-clean-life",
  "雄宿朝元格",
  "石中隐玉格",
  "君臣庆会格",
  "branches: [\"chen\", \"xu\", \"chou\", \"wei\"]",
  "life-stars-with-adjacent-star-sets",
  "life-scope-all-with-brightness",
  "FAVORABLE_BRIGHTNESS_LEVELS",
  "ENHANCING_STAR_ID_LIST",
  "SIX_AUSPICIOUS_STAR_IDS",
  "FOUR_MALEFIC_STAR_IDS",
  "EMPTY_ROBBERY_STAR_IDS",
  "MAJOR_MALEFIC_STAR_IDS",
  "MAJOR_MALEFIC_AND_JI_STAR_IDS",
  "ROMANCE_STAR_IDS",
  "SOLITARY_STAR_IDS",
  "lifeBrightnessLevels",
  "formatBrightnessEvidence",
  "life-branch-with-scope-stars",
  "life-stars-with-scope-at-least",
  "life-branch-with-stars",
  "blockedScopeStarIds",
  "ZiweiPatternStrength",
  "ZIWEI_PATTERN_STRENGTH_LABELS",
  "ENHANCING_STAR_IDS",
  "TRANSFORMATION_STAR_IDS",
  "AUSPICIOUS_TRANSFORMATION_STAR_IDS",
  "enhancedCount",
  "brokenCount",
  "strengthReasonLines",
  "matchedPalaces",
  "ziwei.misc.tianxing",
  "buildZiweiPatternMatches",
  "summarizeZiweiPatterns"
]

for (const marker of catalogMarkers) {
  requireIncludes(texts.patternCatalog, marker, "ziwei-pattern-catalog.ts")
}

const explanationMarkers = [
  "buildZiweiPatternExplanation",
  "ZiweiPatternExplanationView",
  "ZiweiPatternMatchView",
  "ADVERSE_PATTERN_CATEGORIES",
  "CATEGORY_FOCUS_LINES",
  "判定条件",
  "复核要点",
  "强弱依据",
  "来源规则"
]

for (const marker of explanationMarkers) {
  requireIncludes(texts.patternExplanation, marker, "ziwei-pattern-explanation.ts")
}

const detailedAnalysisMarkers = [
  "buildZiweiPatternDetailedAnalysis",
  "buildZiweiPatternDetailedAnalyses",
  "getPatternContentDetail",
  "statusLine",
  "structureLines",
  "effectLines",
  "breakLines",
  "reviewLines",
  "破格依据",
  "不良结构复核",
  "来源规则"
]

for (const marker of detailedAnalysisMarkers) {
  requireIncludes(
    texts.patternDetailedAnalysis,
    marker,
    "ziwei-pattern-detailed-analysis.ts"
  )
}

const sourceIndexMarkers = [
  "buildZiweiPatternSourceIndex",
  "ZiweiPatternSourceIndexRow",
  "ZIWEI_PATTERN_DEFINITIONS",
  "MATCH_METHOD_LABELS",
  "calibrationStatus",
  "scopeLabel"
]

for (const marker of sourceIndexMarkers) {
  requireIncludes(texts.patternSourceIndex, marker, "ziwei-pattern-source-index.ts")
}

const patternFilterMarkers = [
  "PatternFilterValue",
  "buildPatternFilterValues",
  "getPatternFilterLabel",
  "ZIWEI_PATTERN_CATEGORY_LABELS"
]

for (const marker of patternFilterMarkers) {
  requireIncludes(texts.patternFilter, marker, "ziwei-pattern-filter.ts")
}

const gapMarkers = [
  "buildZiweiPatternGaps",
  "summarizeZiweiPatternGaps",
  "ZiweiPatternGapView",
  "missingStarLabels",
  "reviewLines",
  "sourceRuleIds"
]

for (const marker of gapMarkers) {
  requireIncludes(texts.patternGaps, marker, "ziwei-pattern-gaps.ts")
}

const statisticsMarkers = [
  "buildZiweiPatternStatistics",
  "ZiweiPatternStatisticsView",
  "ZiweiPatternCategoryStatistic",
  "adverseHitCount",
  "categoryStats",
  "ADVERSE_PATTERN_CATEGORIES"
]

for (const marker of statisticsMarkers) {
  requireIncludes(texts.patternStatistics, marker, "ziwei-pattern-statistics.ts")
}

const exportSummaryMarkers = [
  "buildZiweiPatternExportSummary",
  "ZiweiPatternExportSummary",
  "buildZiweiPatternStatistics",
  "sortZiweiPatternMatchesByPriority",
  "紫微斗数格局命中摘要",
  "凶格与煞曜结构",
  "加吉增强",
  "煞忌破格"
]

for (const marker of exportSummaryMarkers) {
  requireIncludes(texts.patternExportSummary, marker, "ziwei-pattern-export-summary.ts")
}

const priorityMarkers = [
  "sortZiweiPatternMatchesByPriority",
  "getZiweiPatternPriorityLabel",
  "ADVERSE_PATTERN_CATEGORIES",
  "凶格优先",
  "破格优先",
  "增强优先",
  "命中优先"
]

for (const marker of priorityMarkers) {
  requireIncludes(texts.patternPriority, marker, "ziwei-pattern-priority.ts")
}

const palaceSummaryMarkers = [
  "buildZiweiPatternPalaceSummary",
  "ZiweiPatternPalaceSummaryView",
  "ZiweiPatternPalaceSummaryRow",
  "matchedPalaces",
  "coveredPalaceCount",
  "unplacedGapCount",
  "sortZiweiPatternMatchesByPriority"
]

for (const marker of palaceSummaryMarkers) {
  requireIncludes(
    texts.patternPalaceSummary,
    marker,
    "ziwei-pattern-palace-summary.ts"
  )
}

const consistencyMarkers = [
  "buildZiweiPatternConsistencyReport",
  "ZiweiPatternConsistencyReport",
  "ZiweiPatternConsistencyCheck",
  "buildZiweiPatternStatistics",
  "buildZiweiPatternGaps",
  "buildZiweiPatternPalaceSummary",
  "buildZiweiPatternSourceIndex",
  "buildZiweiPatternExportSummary",
  "catalog-match-count",
  "unique-pattern-ids",
  "palace-reference"
]

for (const marker of consistencyMarkers) {
  requireIncludes(
    texts.patternConsistency,
    marker,
    "ziwei-pattern-consistency.ts"
  )
}

const sourcePanelMarkers = [
  "export function PatternSourceIndexPanel",
  "buildZiweiPatternSourceIndex",
  "buildZiweiPatternMatches",
  "格局来源索引",
  "patternSourceSummaryGrid",
  "patternSourceCard",
  "patternId",
  "校准"
]

for (const marker of sourcePanelMarkers) {
  requireIncludes(texts.patternSourcePanel, marker, "pattern-source-index-panel.tsx")
}

const gapPanelMarkers = [
  "export function PatternGapPanel",
  "buildZiweiPatternGaps",
  "summarizeZiweiPatternGaps",
  "格局缺口校准",
  "patternGapSummaryGrid",
  "patternGapCard",
  "缺星",
  "复核"
]

for (const marker of gapPanelMarkers) {
  requireIncludes(texts.patternGapPanel, marker, "pattern-gap-panel.tsx")
}

const statisticsPanelMarkers = [
  "export function PatternStatisticsPanel",
  "buildZiweiPatternStatistics",
  "buildZiweiPatternExportSummary",
  "buildZiweiPatternMatches",
  "PatternFilterValue",
  "onSelectPatternFilter",
  "copyExportSummary",
  "复制摘要",
  "格局统计",
  "patternStatisticsSummaryGrid",
  "patternExportSummary",
  "patternStatisticsCategoryButton",
  "patternStatisticsCard",
  "凶格命中",
  "查看格局字典"
]

for (const marker of statisticsPanelMarkers) {
  requireIncludes(texts.patternStatisticsPanel, marker, "pattern-statistics-panel.tsx")
}

const palaceSummaryPanelMarkers = [
  "export function PatternPalaceSummaryPanel",
  "buildZiweiPatternPalaceSummary",
  "buildZiweiPatternMatches",
  "格局宫位聚合",
  "patternPalaceSummaryGrid",
  "patternPalaceCard",
  "onOpenPatternOverview",
  "未定位缺口"
]

for (const marker of palaceSummaryPanelMarkers) {
  requireIncludes(
    texts.patternPalaceSummaryPanel,
    marker,
    "pattern-palace-summary-panel.tsx"
  )
}

const consistencyPanelMarkers = [
  "export function PatternConsistencyPanel",
  "buildZiweiPatternConsistencyReport",
  "buildZiweiPatternMatches",
  "格局一致性校准",
  "patternConsistencySummaryGrid",
  "patternConsistencyCard",
  "需处理",
  "已一致"
]

for (const marker of consistencyPanelMarkers) {
  requireIncludes(
    texts.patternConsistencyPanel,
    marker,
    "pattern-consistency-panel.tsx"
  )
}

const panelMarkers = [
  "export function PatternOverviewPanel",
  "buildZiweiPatternMatches",
  "buildZiweiPatternExplanation",
  "buildZiweiPatternDetailedAnalysis",
  "sortZiweiPatternMatchesByPriority",
  "getZiweiPatternPriorityLabel",
  "summarizeZiweiPatterns",
  "STATUS_FILTER_OPTIONS",
  "CATEGORY_FILTER_OPTIONS",
  "PatternDictionaryMode",
  "PATTERN_DICTIONARY_MODE_OPTIONS",
  "selectedMode",
  "setSelectedMode",
  "patternDictionaryModeTabs",
  "selectedFilter",
  "onFilterChange",
  "patternFilterGrid",
  "visibleMatches",
  "match.status === \"hit\"",
  "formatPatternScopeLabel",
  "原盘格局",
  "盘中结果",
  "filteredMatches",
  "{formatPatternScopeLabel(props.scopeLabel)}：{filteredMatches.length} 条",
  "onSelectBranch",
  "onOpenCatalog",
  "patternStrengthLine",
  "patternCardAdverse",
  "patternExplanation",
  "格局本体",
  "成格条件",
  "破格条件",
  "命中证据",
  "盘中位置",
  "strengthLabel",
  "sourceRuleIds"
]

for (const marker of panelMarkers) {
  requireIncludes(texts.patternPanel, marker, "pattern-overview-panel.tsx")
}

const pageMarkers = [
  "PatternOverviewPanel",
  "PatternPalaceSummaryPanel",
  "PatternConsistencyPanel",
  "PatternGapPanel",
  "PatternStatisticsPanel",
  "PatternSourceIndexPanel",
  "selectedPatternFilter",
  "setSelectedPatternFilter",
  'moduleId="pattern-overview"',
  'moduleId="pattern-palace-summary"',
  'moduleId="pattern-consistency"',
  'moduleId="pattern-gaps"',
  'moduleId="pattern-statistics"',
  'moduleId="pattern-source-index"',
  "palaces={viewModel.palaceDetails}",
  "onSelectBranch={setSelectedBranch}",
  'onOpenCatalog={() => openModule("star-catalog")}'
]

for (const marker of pageMarkers) {
  requireIncludes(texts.clientPage, marker, "ziwei-client-page.tsx")
}

const registryMarkers = [
  'id: "pattern-overview"',
  'id: "pattern-palace-summary"',
  'id: "pattern-consistency"',
  'id: "pattern-gaps"',
  'id: "pattern-statistics"',
  'id: "pattern-source-index"',
  'label: "格局字典"',
  'label: "格局宫位聚合"',
  'label: "格局一致性校准"',
  'label: "格局缺口校准"',
  'label: "格局统计"',
  'label: "格局来源索引"',
  "defaultCollapsed: false"
]

for (const marker of registryMarkers) {
  requireIncludes(texts.registry, marker, "ziwei-module-registry.ts")
}

const styleMarkers = [
  ".patternSummaryGrid",
  ".patternCardHit",
  ".patternCardEnhanced",
  ".patternCardBroken",
  ".patternCardAdverse",
  ".patternStrengthLine",
  ".patternCardPending",
  ".patternExplanation",
  ".patternExplanationFavorable",
  ".patternExplanationAdverse",
  ".patternExplanationNeutral",
  ".patternExplanationList",
  ".patternFacts",
  ".patternFilterGrid",
  ".patternFilterButton",
  ".patternFilterButtonActive",
  ".patternDictionaryModeTabs",
  ".patternDictionaryModeTab",
  ".patternDictionaryModeTabActive",
  ".patternActionRow",
  ".patternMiniButton",
  ".patternStatisticsSummaryGrid",
  ".patternStatisticsList",
  ".patternStatisticsCategoryButton",
  ".patternStatisticsCard",
  ".patternStatisticsFacts",
  ".patternExportSummary",
  ".patternExportSummaryHeader",
  ".patternPalaceSummaryGrid",
  ".patternPalaceGrid",
  ".patternPalaceCard",
  ".patternPalaceCardSelected",
  ".patternPalaceEntry",
  ".patternConsistencySummaryGrid",
  ".patternConsistencyCard",
  ".patternConsistencyPass",
  ".patternConsistencyWarn",
  ".patternConsistencyFail",
  ".patternGapSummaryGrid",
  ".patternGapGroupStack",
  ".patternGapCard",
  ".patternGapFacts",
  ".patternSourceSummaryGrid",
  ".patternSourceGroupStack",
  ".patternSourceCard",
  ".patternSourceFacts"
]

for (const marker of styleMarkers) {
  requireIncludes(texts.styles, marker, "ziwei-page.module.css")
}

const docMarkers = [
  "pattern-overview-panel.tsx",
  "pattern-palace-summary-panel.tsx",
  "pattern-consistency-panel.tsx",
  "pattern-gap-panel.tsx",
  "pattern-statistics-panel.tsx",
  "pattern-source-index-panel.tsx",
  "ziwei-pattern-catalog.ts",
  "ziwei-pattern-explanation.ts",
  "ziwei-pattern-filter.ts",
  "ziwei-pattern-gaps.ts",
  "ziwei-pattern-statistics.ts",
  "ziwei-pattern-export-summary.ts",
  "ziwei-pattern-priority.ts",
  "ziwei-pattern-palace-summary.ts",
  "ziwei-pattern-consistency.ts",
  "ziwei-pattern-source-index.ts",
  "ziwei-pattern-detailed-analysis.ts",
  "格局字典",
  "格局宫位聚合",
  "格局一致性校准",
  "格局缺口校准",
  "格局统计",
  "格局来源索引",
  "文星拱命",
  "check-pattern-overview-panel.mjs",
  "check-pattern-detailed-analysis.mjs",
  "| 62 | P13 | 格局目录与格局字典模块",
  "| 63 | P13 | 格局判定细则第一批",
  "| 64 | P13 | 格局判定细则第二批",
  "| 65 | P13 | 格局判定细则第三批",
  "| 66 | P13 | 格局强弱等级展示",
  "| 67 | P13 | 格局筛选与宫位联动",
  "| 68 | P13 | 凶格破格目录第一批",
  "| 69 | P13 | 格局解释层",
  "| 70 | P13 | 格局来源索引与校准表",
  "| 71 | P13 | 格局统计面板",
  "| 72 | P13 | 格局筛选状态联动升级",
  "| 73 | P13 | 格局状态 URL 同步",
  "| 74 | P13 | 格局命中导出摘要",
  "| 75 | P13 | 格局命中排序与重点置顶",
  "| 76 | P13 | 格局未成格缺口面板",
  "| 77 | P13 | 格局规则补全第二批",
  "| 78 | P13 | 格局规则补全第三批：庙旺条件",
  "| 79 | P13 |",
  "| 80 | P13 | 格局按宫位聚合视图",
  "| 82 | P13 | 格局规则补全第五批：不良格局与破格条件扩展",
  "| 83 | P13 | 格局规则补全第六批：主星化忌与组合败格扩展",
  "| 84 | P13 | 格局规则补全第七批：吉格成格条件补强",
  "| 85 | P13 | 格局目录一致性校准"
]

for (const marker of docMarkers) {
  const text =
    marker.startsWith("| 62 |") ||
    marker.startsWith("| 63 |") ||
    marker.startsWith("| 64 |") ||
    marker.startsWith("| 65 |") ||
    marker.startsWith("| 66 |") ||
    marker.startsWith("| 67 |") ||
    marker.startsWith("| 68 |") ||
    marker.startsWith("| 69 |") ||
    marker.startsWith("| 70 |") ||
    marker.startsWith("| 71 |") ||
    marker.startsWith("| 72 |") ||
    marker.startsWith("| 73 |") ||
    marker.startsWith("| 74 |") ||
    marker.startsWith("| 75 |") ||
    marker.startsWith("| 76 |") ||
    marker.startsWith("| 77 |") ||
    marker.startsWith("| 78 |") ||
    marker.startsWith("| 79 |") ||
    marker.startsWith("| 80 |") ||
    marker.startsWith("| 82 |") ||
    marker.startsWith("| 83 |") ||
    marker.startsWith("| 84 |") ||
    marker.startsWith("| 85 |")
    ? texts.executionDoc
    : marker === "check-pattern-overview-panel.mjs"
      ? `${texts.pageDoc}\n${texts.directoryDoc}`
      : `${texts.pageDoc}\n${texts.directoryDoc}`

  requireIncludes(text, marker, "ziwei pattern docs")
}

console.log("[check-pattern-overview-panel] ok")
