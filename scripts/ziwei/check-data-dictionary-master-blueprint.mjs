import { readFileSync } from "node:fs"

const blueprintPath = "docs/ziwei/DATA_DICTIONARY_MASTER_BLUEPRINT.md"
const content = readFileSync(blueprintPath, "utf8")

const requiredHeadings = [
  "# 紫微斗数数据字典大模块蓝图",
  "## 模块目标",
  "## 总体边界",
  "## 字典目录结构",
  "## 星曜本体资料标准",
  "## 星曜入宫资料标准",
  "## 十二地支与空间组",
  "## 庙旺落陷与杂曜边界",
  "## 星曜组合资料标准",
  "## 格局字典资料标准",
  "## 动态盘资料标准",
  "## 当前盘正统分析流程",
  "## 专题分析输出标准",
  "## 来源与复核标准",
  "## 本轮收口标准"
]

const requiredTerms = [
  "总字典",
  "当前盘命中层",
  "当前盘解释层",
  "复核层",
  "四马地",
  "四败地",
  "四墓库地",
  "三方四正",
  "左右夹宫",
  "生年四化",
  "大限四化",
  "流年四化",
  "流月四化",
  "流日四化",
  "流时四化",
  "没有亮度来源的杂曜不硬套庙旺",
  "当前盘解释必须先有证据链",
  "现代网站和现代书籍只作为元信息"
]

function fail(message) {
  console.error(`[check-data-dictionary-master-blueprint] ${message}`)
  process.exit(1)
}

for (const heading of requiredHeadings) {
  if (!content.includes(heading)) {
    fail(`missing heading: ${heading}`)
  }
}

for (const term of requiredTerms) {
  if (!content.includes(term)) {
    fail(`missing required term: ${term}`)
  }
}

if (content.includes("todo") || content.includes("TODO")) {
  fail("blueprint should not contain TODO placeholders")
}

console.log("[check-data-dictionary-master-blueprint] ok")
