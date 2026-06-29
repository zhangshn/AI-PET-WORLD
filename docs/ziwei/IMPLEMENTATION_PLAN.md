# 紫微斗数实施计划

版本：v0.2  
状态：分阶段计划  
更新日期：2026-06-27

## 阶段 0：参数契约层

目标：先定义唯一参数来源，后面所有模块都调用它。

新增：

```txt
src/ai/destiny-core/ziwei-core/contracts/
```

验收：

1. 跨模块类型只在 `contracts` 中 export。
2. API、页面、算法都不重复定义请求、响应、ViewModel、星曜、宫位类型。
3. `contracts/index.ts` 统一导出。
4. 旧 `ziwei-core-schema.ts` 暂时保留，由 adapter 做兼容。

## 阶段 0.5：冻结旧模块职责

目标：防止旧模块继续长出新功能，避免新旧两套紫微系统并行。

处理：

1. `ziwei-engine.ts` 不再新增辅曜、煞曜、杂曜、四化。
2. `ziwei-core-schema.ts` 不再新增完整盘参数。
3. `calculator.ts` 后续只作为旧人格适配入口。
4. `knowledge/stars.ts` 不再新增完整盘星曜。
5. `dynamic/*` 不再新增页面展示字段。

验收：

1. 新功能落点符合 [LEGACY_MIGRATION.md](./LEGACY_MIGRATION.md)。
2. 旧人格链路可以继续运行。
3. 新完整盘链路只从 `public-api` 出口调用。

## 阶段 1：只建骨架，不改旧人格输出

目标：先把目录和类型分开。

新增：

```txt
src/ai/destiny-core/ziwei-core/shared/
src/ai/destiny-core/ziwei-core/birth/
src/ai/destiny-core/ziwei-core/natal-foundation/
src/ai/destiny-core/ziwei-core/star-catalog/
src/ai/destiny-core/ziwei-core/star-placement/
src/ai/destiny-core/ziwei-core/full-chart/
src/ai/destiny-core/ziwei-core/adapters/
src/ai/destiny-core/ziwei-core/public-api/
```

验收：

1. 类型可以编译。
2. 旧 `buildPersonalityProfile` 输出不变。
3. 新目录只是接入完整盘，不破坏旧 `ziwei-engine.ts`。
4. 旧文件有明确迁移方向，不继续承载新增完整盘能力。

## 阶段 2：星曜目录

目标：先把“有哪些星曜”定义清楚。

新增：

1. 主星 catalog。
2. 辅曜 catalog。
3. 煞曜 catalog。
4. 四化 catalog。
5. 杂曜 catalog。
6. 长生、博士、岁前、将前 catalog。

验收：

1. 所有星曜有唯一语义 ID。
2. 所有星曜有中文名、分类、显示顺序。
3. `check-star-catalog.mjs` 能发现未分类星曜。

## 阶段 3：本命地基

目标：把当前 `ziwei-engine.ts` 中的基础宫位逻辑拆出来。

拆出：

1. 命身宫。
2. 十二宫顺序。
3. 宫干。
4. 五行局。
5. 对宫和三方四正工具。

验收：

1. 与旧引擎样例输出一致。
2. 12 宫完整。
3. 宫位映射稳定。

## 阶段 4：主星安放

目标：把 14 主星从旧引擎迁移到 `star-placement/main-stars`。

验收：

1. 14 主星全部落盘。
2. 与旧 `ziwei-engine.ts` 主星落点一致。
3. 每颗主星有 `placementRuleId`。

## 阶段 5：完整盘组装

目标：生成 `FullZiweiChart`。

新增：

1. `full-chart-engine.ts`
2. `full-chart-validator.ts`
3. `full-chart-debug-builder.ts`

说明：`FullZiweiChart`、`FullZiweiPalace` 等参数已经在 `contracts/full-chart-contract.ts` 定义，本阶段不重复定义。

验收：

1. 输出 12 宫。
2. 星曜按分类进入宫位。
3. 可输出调试 JSON。

## 阶段 6：辅曜、煞曜、四化

目标：补第一批完整盘关键星曜。

顺序：

1. 左辅右弼、文昌文曲。
2. 天魁天钺、禄存天马。
3. 擎羊陀罗、火星铃星、地空地劫。
4. 本命四化。

验收：

1. 页面能按组显示。
2. `check-star-placement-coverage.mjs` 能检查已启用星曜是否都有落点。

## 阶段 7：杂曜和辅助神煞

目标：不要大杂烩，分目录逐步接。

顺序：

1. `misc-stars/romance-stars.ts`
2. `misc-stars/nobleman-stars.ts`
3. `misc-stars/solitary-stars.ts`
4. `misc-stars/punishment-stars.ts`
5. `lifecycle-stars/*`
6. `annual-stars/*`
7. `monthly-stars/*`
8. `daily-hourly-stars/*`

验收：

1. 每组星曜有独立文件。
2. 页面显示不会把杂曜全部挤进一个文本块。
3. 调试 JSON 能看到每颗星来自哪个规则文件。

## 阶段 8：API 和页面

目标：新增 `/ziwei` 页面。

新增：

1. `POST /api/ziwei/full-chart`
2. `/ziwei/page.tsx`
3. 页面组件和 ViewModel

验收：

1. 输入出生信息能生成盘。
2. 页面有十二宫、详情、星曜总表、动态 Tabs、调试 JSON。
3. 移动端不重叠。

## 阶段 9：动态盘

目标：把完整星曜接入大限、流年、流月、流日、流时。

顺序：

1. 复用现有动态落宫算法。
2. 接 `dynamic-chart`。
3. 接动态四化。
4. 页面 Tabs 展示动态宫位和动态星曜。

验收：

1. 本命、大限、流年、流月、流日、流时都可切换。
2. 未起运状态有明确解释。
3. 动态盘不污染本命盘数据。

## 阶段 10：回归样例和检查脚本

新增：

```txt
data/ziwei/golden-samples/
scripts/ziwei/inspect-full-chart.mjs
scripts/ziwei/check-star-catalog.mjs
scripts/ziwei/check-star-placement-coverage.mjs
scripts/ziwei/check-page-view-model.mjs
```

验收：

1. 固定样例可复现。
2. 星曜目录覆盖可检查。
3. 页面 ViewModel 分组可检查。
4. 后续改算法时能知道哪些落点变了。
