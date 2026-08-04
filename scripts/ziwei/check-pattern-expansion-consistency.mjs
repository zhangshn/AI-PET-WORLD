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
    "ziwei-pattern-catalog.ts",
  ),
  patternOverviewCheck: path.join(
    root,
    "scripts",
    "ziwei",
    "check-pattern-overview-panel.mjs",
  ),
  patternConsistency: path.join(
    root,
    "src",
    "app",
    "ziwei",
    "_lib",
    "ziwei-pattern-consistency.ts",
  ),
  pageStructure: path.join(root, "docs", "ziwei", "PAGE_ACCEPTANCE.md"),
  directoryStructure: path.join(root, "docs", "ziwei", "DIRECTORY_STRUCTURE.md"),
  executionTable: path.join(root, "data", "ziwei", "legacy-execution-verification-baseline-v1.txt"),
}

const expansionBatches = [
  {
    row: 87,
    title: "格局扩库批次一：杂曜与辅佐组合",
    requiredIds: [
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
    ],
    requiredConstants: ["ROMANCE_STAR_IDS", "SOLITARY_STAR_IDS"],
  },
  {
    row: 88,
    title: "格局扩库批次二：主星组合与庙旺守命",
    requiredIds: [
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
    ],
    requiredConstants: ["FAVORABLE_BRIGHTNESS_LEVELS"],
  },
  {
    row: 89,
    title: "格局扩库批次三：夹拱与会照结构扩展",
    requiredIds: [
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
    ],
    requiredConstants: ["SIX_AUSPICIOUS_STAR_IDS"],
  },
  {
    row: 90,
    title: "格局扩库批次四：不良格局与破格第二批",
    requiredIds: [
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
    ],
    requiredConstants: [
      "ROMANCE_STAR_IDS",
      "SOLITARY_STAR_IDS",
      "MAJOR_MALEFIC_AND_JI_STAR_IDS",
    ],
  },
  {
    row: 91,
    title: "格局扩库批次五：四化组合与禄权科忌细化",
    requiredIds: [
      "pattern.wealth.four-transformations-life",
      "pattern.wealth.lu-quan-same-palace",
      "pattern.wealth.lu-ke-same-palace",
      "pattern.wealth.quan-ke-same-palace",
      "pattern.wealth.san-qi-same-palace",
      "pattern.wealth.double-lu-same-palace",
      "pattern.adverse.lu-ji-life-scope",
      "pattern.adverse.quan-ji-life-scope",
      "pattern.adverse.ke-ji-life-scope",
      "pattern.adverse.lu-ji-same-palace",
      "pattern.adverse.quan-ji-same-palace",
      "pattern.adverse.ke-ji-same-palace",
      "pattern.adverse.lu-ji-adjacent-life",
      "pattern.adverse.quan-ji-adjacent-life",
      "pattern.adverse.ke-ji-adjacent-life",
    ],
    requiredConstants: [
      "TRANSFORMATION_STAR_IDS",
      "AUSPICIOUS_TRANSFORMATION_STAR_IDS",
    ],
  },
]

const forbiddenCatalogMarkers = [
  "pattern.adverse.three-transformations-with-ji-life",
  "三化带忌会命格",
]

function fail(message) {
  console.error(`[check-pattern-expansion-consistency] ${message}`)
  process.exit(1)
}

function requireIncludes(text, marker, label) {
  if (!text.includes(marker)) {
    fail(`${label} is missing marker: ${marker}`)
  }
}

const texts = Object.fromEntries(
  Object.entries(files).map(([key, file]) => {
    if (!fs.existsSync(file)) {
      fail(`missing file: ${path.relative(root, file)}`)
    }

    return [key, fs.readFileSync(file, "utf8")]
  }),
)

for (const marker of forbiddenCatalogMarkers) {
  if (texts.patternCatalog.includes(marker)) {
    fail(`catalog still contains forbidden ambiguous marker: ${marker}`)
  }
}

const catalogIds = [...texts.patternCatalog.matchAll(/id:\s*"([^"]+)"/g)].map(
  (match) => match[1],
)
const duplicateIds = catalogIds.filter((id, index) => {
  return catalogIds.indexOf(id) !== index
})

if (duplicateIds.length > 0) {
  fail(`duplicated pattern ids: ${[...new Set(duplicateIds)].join(" / ")}`)
}

for (const batch of expansionBatches) {
  requireIncludes(texts.executionTable, `| ${batch.row} | P14 | ${batch.title}`, "EXECUTION_TABLE.md")

  for (const id of batch.requiredIds) {
    requireIncludes(texts.patternCatalog, `id: "${id}"`, "ziwei-pattern-catalog.ts")
    requireIncludes(texts.patternOverviewCheck, id, "check-pattern-overview-panel.mjs")
  }

  for (const constantName of batch.requiredConstants) {
    requireIncludes(texts.patternCatalog, constantName, "ziwei-pattern-catalog.ts")
    requireIncludes(texts.patternOverviewCheck, constantName, "check-pattern-overview-panel.mjs")
  }
}

const pageMarkers = [
  "扩库批次一",
  "扩库批次二",
  "扩库批次三",
  "扩库批次四",
  "扩库批次五",
  "不能用“至少 N 项”冒充必含化忌条件",
  "check-pattern-expansion-consistency.mjs",
]

for (const marker of pageMarkers) {
  requireIncludes(texts.pageStructure, marker, "PAGE_ACCEPTANCE.md")
}

const directoryMarkers = ["check-pattern-expansion-consistency.mjs"]

for (const marker of directoryMarkers) {
  requireIncludes(texts.directoryStructure, marker, "DIRECTORY_STRUCTURE.md")
}

const consistencyMarkers = [
  "catalog-match-count",
  "source-index-count",
  "palace-hit-count",
  "unique-pattern-ids",
  "palace-reference",
]

for (const marker of consistencyMarkers) {
  requireIncludes(texts.patternConsistency, marker, "ziwei-pattern-consistency.ts")
}

requireIncludes(
  texts.executionTable,
  "| 92 | P14 | 格局扩库一致性二次校准",
  "EXECUTION_TABLE.md",
)

console.log("[check-pattern-expansion-consistency] ok")
