# 紫微斗数解释层架构

版本：v0.1  
状态：骨架已接入  
更新日期：2026-06-28

## 目标

解释层只负责把完整盘转换成可展示、可校准、可追溯的解释数据，不重新排盘，不重新定义参数。

当前先完成三件事：

1. 整盘摘要：命宫、身宫、星曜覆盖情况。
2. 宫位解释：按选中宫位聚合主星、辅曜、煞曜、四化、杂曜、长生、年系、月系、日时系星曜。
3. 规则追溯：每条宫位解释保留 `sourceRuleIds`，后续校准断语时可以回到安星规则表。

## 目录结构

```txt
src/ai/destiny-core/ziwei-core/
  contracts/
    interpretation-contract.ts

  interpretation/
    star-keywords.ts
    star-profile-catalog.ts
    sector-profile-catalog.ts
    star-palace-combination-builder.ts
    transformation-interpretation-builder.ts
    relation-interpretation-builder.ts
    palace-interpretation-builder.ts
    chart-highlight-builder.ts
    interpretation-engine.ts
    index.ts

  public-api/
    build-ziwei-interpretation.ts
```

页面展示：

```txt
src/app/ziwei/
  _components/
    interpretation-panel.tsx
```

检查脚本：

```txt
scripts/ziwei/
  check-interpretation.mjs
```

## 参数边界

解释层新增的跨模块参数只放在：

```txt
src/ai/destiny-core/ziwei-core/contracts/interpretation-contract.ts
```

其他目录只能 import，不允许重复定义同名结构。

核心结构：

| 类型 | 用途 |
|---|---|
| `ZiweiInterpretationItem` | 单条解释，包含标题、摘要、标签、规则来源 |
| `ZiweiPalaceInterpretation` | 单个宫位的解释集合 |
| `ZiweiChartInterpretation` | 整盘解释结果，包含整盘摘要和十二宫解释 |
| `BuildZiweiInterpretationInput` | 解释层入口参数，只接收 `FullZiweiChart` |

## 调用链路

```txt
FullZiweiChart
  -> buildZiweiChartInterpretation()
  -> ZiweiChartInterpretation
  -> buildZiweiPageViewModel()
  -> ZiweiPageViewModel.interpretation
  -> InterpretationPanel
```

页面组件不直接调用 `star-placement`、`full-chart` 或解释层内部文件，只读取 ViewModel。

## 当前解释口径

当前版本只输出轻量提示，不输出最终断语：

1. 主星：提示宫位核心气质和主要驱动力。
2. 辅曜：提示助力、资源、才华和协作条件。
3. 煞曜：提示压力、冲突、风险和需要处理的议题。
4. 四化：提示动态变化触发点。
5. 杂曜：提示细节补充，不覆盖主星和宫位主轴。
6. 长生十二神：提示状态节律和阶段性气势。
7. 年系、月系、日时系：提示不同时间层级的补充信息。

## 星曜 Profile

星曜解释资料放在：

```txt
src/ai/destiny-core/ziwei-core/interpretation/star-profile-catalog.ts
```

当前规则：

1. 星曜 ID 和中文名仍以 `star-catalog` 为唯一来源。
2. `star-profile-catalog.ts` 只补解释摘要和标签，不重新定义星曜落点。
3. 主星、辅曜、煞曜、四化、杂曜、长生十二神有独立解释口径。
4. 年系、月系、日时系星曜当前先使用类别模板兜底，后续可逐颗补充。
5. `check-interpretation.mjs` 会检查 103 颗星曜都能取得解释 profile。

## 宫位 Profile 与组合解释

宫位资料放在：

```txt
src/ai/destiny-core/ziwei-core/interpretation/sector-profile-catalog.ts
```

星曜入宫组合提示放在：

```txt
src/ai/destiny-core/ziwei-core/interpretation/star-palace-combination-builder.ts
```

当前规则：

1. `sector-profile-catalog.ts` 只定义十二宫观察重点，不定义星曜落点。
2. `star-palace-combination-builder.ts` 只组合星曜 profile 和宫位 profile。
3. 组合解释的 `scope` 为 `combination`，方便页面和后续断语层区分。
4. 每条组合解释继续保留原星曜的 `sourceRuleIds`。
5. 当前组合解释是轻量提示，后续可按「星曜 + 宫位 + 四化 + 三方四正」逐步校准。

## 四化解释

四化解释放在：

```txt
src/ai/destiny-core/ziwei-core/interpretation/transformation-interpretation-builder.ts
```

当前规则：

1. 四化解释读取 `ZiweiPlacedStar.targetStarId`，不重新推导四化规则。
2. 标题统一为「化禄/化权/化科/化忌 作用 目标星」。
3. 摘要同时包含四化性质、目标星提示、所在宫位重点。
4. `scope` 为 `dynamic`，`category` 保持 `transformation`。
5. 每条四化解释继续保留 `sourceRuleIds`，当前指向 `transformation.natal.year-stem`。

## 三方四正解释

三方四正解释放在：

```txt
src/ai/destiny-core/ziwei-core/interpretation/relation-interpretation-builder.ts
```

当前规则：

1. 只读取 `FullZiweiPalace.oppositeBranch` 和 `FullZiweiPalace.trineBranches`，不重新计算宫位关系。
2. 每个宫位生成一条 `scope: "relation"` 的结构解释。
3. 关系范围包含本宫、对宫、三方两宫。
4. 当前先汇总主星、辅曜、煞曜、四化，后续再补传统结构断语。
5. 关系解释继续聚合并保留相关星曜的 `sourceRuleIds`。

后续校准传统断语时，按星曜、宫位、组合、四化、动态流逐层补充，不把长篇文案写进排盘算法。

## 验收

```bash
node scripts/ziwei/check-interpretation.mjs
node scripts/ziwei/check-api-route.mjs
npx tsc --noEmit --pretty false
```

通过标准：

1. 解释层输出 12 个宫位解释。
2. 命宫至少有解释项。
3. 宫位解释项保留 `sourceRuleIds`。
4. 每颗 catalog 星曜都有解释 profile。
5. 十二宫都有宫位 profile。
6. 宫位解释包含星曜级条目。
7. 宫位解释包含有规则来源的组合条目。
8. 四化解释包含目标星和规则来源。
9. 每个宫位解释包含三方四正关系条目。
10. `ZiweiPageViewModel.interpretation` 与直接构建结果一致。
11. API 返回的 ViewModel 包含解释层数据。
