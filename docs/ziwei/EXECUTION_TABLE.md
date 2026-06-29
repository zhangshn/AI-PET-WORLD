# 紫微斗数完整盘执行计划表

版本：v0.1  
状态：本轮完整盘改造完成  
更新日期：2026-06-28

## 状态说明

| 状态 | 含义 |
|---|---|
| 未开始 | 还没有动代码 |
| 进行中 | 当前正在做 |
| 待验证 | 代码已完成，等检查/测试 |
| 已完成 | 已通过验收 |
| 暂缓 | 依赖未满足或优先级后置 |

## 总执行表

| 序号 | 阶段 | 任务 | 主要产物 | 依赖 | 验收标准 | 状态 |
|---|---|---|---|---|---|---|
| 0 | 文档 | 架构文档拆分 | `docs/ziwei/*` | 无 | 目录、参数、旧模块迁移、页面、算法、执行表完整 | 已完成 |
| 1 | P0 | 建立参数契约目录 | `contracts/*` | 文档完成 | 跨模块类型集中导出，不重复定义 | 已完成 |
| 2 | P0 | 建立基础目录骨架 | `shared/`、`birth/`、`natal-foundation/`、`star-catalog/`、`star-placement/`、`full-chart/`、`dynamic-chart/`、`adapters/`、`public-api/` | P0 参数契约 | 目录存在，空入口可编译 | 已完成 |
| 3 | P0.5 | 冻结旧模块职责 | 旧文件 deprecated 注释、迁移说明 | P0 目录骨架 | 旧 `ziwei-engine.ts` 不承载新辅曜/杂曜/四化 | 已完成 |
| 4 | P1 | 抽出基础类型 | `branch-contract.ts`、`stem-contract.ts`、`palace-contract.ts`、`birth-contract.ts`、`lunar-contract.ts` | P0 | 旧类型有新契约映射 | 已完成 |
| 5 | P1 | 抽出星曜类型 | `star-contract.ts`、`placement-contract.ts` | P0 | 星曜 ID、分类、安星结果只定义一次 | 已完成 |
| 6 | P1 | 抽出完整盘类型 | `foundation-contract.ts`、`full-chart-contract.ts`、`dynamic-chart-contract.ts`、`page-view-contract.ts`、`error-contract.ts` | P0 | API、页面、算法可统一 import | 已完成 |
| 7 | P2 | 迁移出生输入与农历适配 | `birth/lunar-adapter.ts`、`time-branch-resolver.ts`、`ganzhi-resolver.ts` | P1 类型 | 旧样例农历、时辰、干支输出一致 | 已完成 |
| 8 | P2 | 迁移本命地基算法 | `natal-foundation/*` | P1 类型、P2 birth | 命宫、身宫、十二宫、宫干、五行局与旧引擎一致 | 已完成 |
| 9 | P2 | 迁移 14 主星安放 | `star-placement/main-stars/*` | P2 本命地基 | 14 主星落点与旧引擎一致，无重复遗漏 | 已完成 |
| 10 | P2 | 建旧人格适配器 | `adapters/legacy-birth-pattern-adapter.ts` | P2 主星 | `buildPersonalityProfile` 输出不变 | 已完成 |
| 11 | P3 | 建星曜目录 | `star-catalog/*` | P1 星曜类型 | 主星、辅曜、煞曜、四化、杂曜、长生、年系、月系、日时系有唯一 catalog | 已完成 |
| 12 | P3 | 建完整盘组装 | `full-chart/full-chart-engine.ts`、`palace-star-groups.ts`、`full-chart-validator.ts` | P2 主星、P3 catalog | 输出 12 宫完整盘和调试信息 | 已完成 |
| 13 | P3 | 建检查脚本 | `scripts/ziwei/check-contract-duplicates.mjs`、`check-star-catalog.mjs` | P1/P3 | 能检查重复参数、未分类星曜 | 已完成 |
| 14 | P4 | 接入辅曜 | `assistant-stars/*` | P3 full-chart | 左辅右弼、文昌文曲、天魁天钺、禄存天马可落盘 | 已完成 |
| 15 | P4 | 接入煞曜 | `malefic-stars/*` | P3 full-chart | 擎羊陀罗、火星铃星、地空地劫可落盘 | 已完成 |
| 16 | P4 | 接入四化 | `transformations/*` | P3 full-chart | 化禄、化权、化科、化忌可显示目标星 | 已完成 |
| 17 | P5 | 接入杂曜 | `misc-stars/*` | P4 | 杂曜按 romance/nobleman/solitary/punishment 拆分落盘 | 已完成 |
| 18 | P5 | 接入长生/博士/岁前/将前 | `lifecycle-stars/*`、`annual-stars/*` | P4 | 不塞入 misc，独立分组展示 | 已完成 |
| 19 | P5 | 接入月日时系星曜 | `monthly-stars/*`、`daily-hourly-stars/*` | P4 | 按月、日、时来源可追踪 | 已完成 |
| 20 | P6 | 迁移动态层 | `dynamic-chart/*` | P3 full-chart | `check-dynamic-chart.mjs` 通过；大限、流年、流月、流日、流时与旧动态结果一致 | 已完成 |
| 21 | P7 | 建 API | `app/api/ziwei/full-chart/route.ts` | P3 full-chart、P6 dynamic 可后置 | `check-api-route.mjs` 通过；API 只调用 `public-api`，不重复定义参数 | 已完成 |
| 22 | P7 | 建页面 ViewModel | `public-api/build-ziwei-page-view-model.ts`、`app/ziwei/_lib/ziwei-page-view-model.ts` | P7 API 类型 | `check-api-route.mjs` 通过；宫格、详情、星曜总表、动态 Tabs 数据完整 | 已完成 |
| 23 | P7 | 建 `/ziwei` 页面 | `app/ziwei/page.tsx`、`_components/*`、`_styles/*` | P7 ViewModel | 页面可输入、排盘、切换宫位、查看 JSON；相关目录 lint/tsc/API 检查通过 | 已完成 |
| 24 | P8 | 回归样例 | `data/ziwei/golden-samples/*`、`inspect-full-chart.mjs` | P7 页面/API | `inspect-full-chart.mjs` 通过；固定样例可复现，后续变更可对比 | 已完成 |
| 25 | P8 | 最终检查 | lint、类型检查、脚本检查 | 全部 | 紫微相关 lint、类型检查、脚本检查、编码检查通过；无重复契约、页面不越级调用 | 已完成 |
| 26 | P9 | 建规则来源表 | `RULE_SOURCE_TABLE.md`、`check-rule-source-table.mjs` | P8 | 代码中所有 `placementRuleId` 都在规则表记录，待校准项明确 | 已完成 |
| 27 | P9 | 页面交互二版 | `/ziwei` 组件与 ViewModel | P7 页面 | 动态流联动宫位、星曜总表分类筛选、流时中文显示；浏览器验证通过 | 已完成 |
| 28 | P9 | 扩展回归样例 | `data/ziwei/golden-samples/*` | P8 | 7 个样例覆盖顺行、逆行、未起运、亥时/子时边界；`inspect-full-chart.mjs` 强制校验 | 已完成 |
| 29 | P10 | 解释层骨架 | `interpretation/*`、`interpretation-contract.ts`、`interpretation-panel.tsx`、`check-interpretation.mjs` | P9 | ViewModel 输出整盘摘要和十二宫解释；每条宫位解释保留规则来源；页面可按选中宫位展示 | 已完成 |
| 30 | P10 | 星曜级解释资料 | `star-profile-catalog.ts`、`palace-interpretation-builder.ts` | P10 | 103 颗 catalog 星曜都能取得解释 profile；宫位解释包含星曜级条目；规则来源继续保留 | 已完成 |
| 31 | P10 | 宫位与星曜组合解释 | `sector-profile-catalog.ts`、`star-palace-combination-builder.ts` | P10 | 十二宫都有 profile；宫位解释包含 `combination` 条目；组合条目继续保留规则来源 | 已完成 |
| 32 | P10 | 四化解释层 | `transformation-interpretation-builder.ts`、`palace-interpretation-builder.ts` | P10 | 四化解释显示作用目标星；摘要包含四化性质、目标星和宫位重点；规则来源继续保留 | 已完成 |
| 33 | P10 | 三方四正解释层 | `relation-interpretation-builder.ts`、`palace-interpretation-builder.ts` | P10 | 每个宫位生成 `relation` 条目；范围包含本宫、对宫、三方；主星/辅曜/煞曜/四化和规则来源被汇总 | 已完成 |
| 34 | P11 | 十二宫盘面布局 | `ziwei-chart-grid.tsx`、`ziwei-page.module.css`、`PAGE_STRUCTURE.md` | P7 页面 | 桌面为 4×4 外圈盘加中宫；地支位置为巳午未申/辰酉/卯戌/寅丑子亥；移动端不横向溢出 | 已完成 |
| 35 | P11 | 盘面布局回归检查 | `ziwei-palace-layout.ts`、`check-page-layout.mjs`、`PAGE_STRUCTURE.md` | P11 | 盘面位置、桌面行列、移动端行列集中到 `_lib`；组件注入 CSS 变量；静态检查 12 地支 area、中宫和移动端 center 行 | 已完成 |
| 36 | P11 | 中宫摘要增强 | `ziwei-chart-grid.tsx`、`check-page-layout.mjs`、`PAGE_STRUCTURE.md` | P11 | 中宫展示选中宫位、星曜分组数、全盘星曜数、出生摘要、规则版本、命身宫；静态检查覆盖这些字段 | 已完成 |
| 37 | P11 | 客户端导入边界检查 | `ziwei-form-options.ts`、`check-client-boundary.mjs`、`PAGE_STRUCTURE.md` | P11 | 客户端组件只 type-import `contracts`；表单选项等运行时常量留在页面 `_lib`；静态检查防止客户端误拉核心排盘模块 | 已完成 |
| 38 | P11 | 宫位详情分层展示 | `palace-detail-panel.tsx`、`star-group-list.tsx`、`check-palace-detail-layout.mjs`、`PAGE_STRUCTURE.md` | P11 | 详情面板拆成宫位基础、三方四正、核心星曜、周期与流系星曜、安星调试；不新增重复参数，只消费 ViewModel | 已完成 |
| 39 | P11 | 星曜总表筛选与规则来源 | `star-catalog-table.tsx`、`check-star-catalog-table.mjs`、`PAGE_STRUCTURE.md` | P11 | 总表支持分类筛选、落宫筛选、规则关键词搜索；每行保留 `placementRuleId`；不在页面重复解释安星规则 | 已完成 |
| 40 | P11 | 动态流摘要与状态展示 | `dynamic-flow-tabs.tsx`、`page-view-contract.ts`、`check-dynamic-flow-panel.mjs`、`PAGE_STRUCTURE.md` | P11 | 页面显示行运方向、起运岁数、当前年龄、启用流数量；六个动态流显示落宫、启用状态、未启用原因；动态参数只从 ViewModel 读取 | 已完成 |
| 41 | P11 | 解释面板分层与规则追踪 | `interpretation-panel.tsx`、`check-interpretation-panel-layout.mjs`、`PAGE_STRUCTURE.md` | P11 | 解释面板拆成整盘摘要、当前宫位解释、规则来源追踪；聚合 `sourceRuleIds`；不在页面重算星曜或重复定义参数 | 已完成 |
| 42 | P11 | 调试 JSON 分视图展示 | `debug-json-panel.tsx`、`check-debug-json-panel.mjs`、`PAGE_STRUCTURE.md` | P11 | 调试面板拆成盘面摘要、完整本命盘、动态盘；摘要显示星曜数量、警告数量、动态流数量；不把正式文案和调试 JSON 混用 | 已完成 |
| 43 | P11 | 宫位星曜明细与规则追踪 | `page-view-contract.ts`、`star-group-list.tsx`、`palace-detail-panel.tsx`、`check-star-detail-view.mjs` | P11 | `ZiweiStarView` 带出星曜 ID、分类标签、`placementRuleId`；宫位详情每颗星显示规则来源；宫格仍保持紧凑展示 | 已完成 |
| 44 | P11 | 宫位关系视图统一 | `page-view-contract.ts`、`page-view-model-builder.ts`、`palace-detail-panel.tsx`、`check-palace-relation-view.mjs` | P11 | `ZiweiPalaceRelationView` 统一输出本宫、对宫、三方、邻宫；详情页只消费 ViewModel，不直接拼接宫位关系字段 | 已完成 |
| 45 | P11 | 十二宫完整明细总览 | `palace-overview-panel.tsx`、`ziwei-star-group-filters.ts`、`ziwei-client-page.tsx`、`check-palace-overview-panel.mjs` | P11 | 中间盘面下方展示 12 宫完整明细；每宫显示星曜、关系摘要、规则来源数量；星曜分类集合只在 `_lib` 定义一次 | 已完成 |
| 46 | P11 | 杂曜专项总览与来源追踪 | `misc-star-panel.tsx`、`ziwei-misc-star-groups.ts`、`ziwei-client-page.tsx`、`check-misc-star-panel.mjs` | P11 | 页面单独展示全部 15 颗杂曜；按 `placementRuleId` 前缀归类为桃花喜庆、贵人与仪制、孤寡、刑耗哭虚；每颗保留落宫、星曜 ID 和规则来源 | 已完成 |
| 47 | P11 | 动态流完整明细总览 | `page-view-contract.ts`、`page-view-model-builder.ts`、`dynamic-flow-overview-panel.tsx`、`check-dynamic-flow-overview-panel.mjs` | P11 | ViewModel 输出 `dynamicFlowDetails`；页面展示本命、大限、流年、流月、流日、流时的状态、落宫、权重、星曜数量和规则来源数量；点击明细联动当前宫位 | 已完成 |
| 48 | P11 | 规则来源总览与校准索引 | `rule-source-overview-panel.tsx`、`ziwei-rule-source-index.ts`、`ziwei-client-page.tsx`、`check-rule-source-overview-panel.mjs` | P11 | 页面按分类聚合全盘 `placementRuleId`；每条规则显示覆盖星曜、落宫覆盖和出现次数；分类标题联动星曜总表筛选 | 已完成 |
| 49 | P11 | 同名星曜与跨分组校准 | `same-name-star-panel.tsx`、`ziwei-same-name-stars.ts`、`ziwei-client-page.tsx`、`check-same-name-star-panel.mjs` | P11 | 页面找出显示名相同但 `starId` 不同的星曜；保留分类、落宫、星曜 ID、规则来源；用于校准天巫、咸池等跨分组条目 | 已完成 |
| 50 | P11 | 星曜分类统计与落宫分布 | `star-category-summary-panel.tsx`、`ziwei-star-category-summary.ts`、`ziwei-client-page.tsx`、`check-star-category-summary-panel.mjs` | P11 | 页面按分类统计 103 颗星曜；每类显示星曜数量、落宫覆盖、规则来源数量和宫位列表；分类卡片联动星曜总表筛选 | 已完成 |

## 第一批开工任务

先做下面 6 项，不跳到页面：

| 顺序 | 任务 | 产物 | 完成后才能进入 | 状态 |
|---|---|---|---|---|
| 1 | 建 `contracts` 目录 | 参数唯一来源 | 所有后续模块 | 已完成 |
| 2 | 建基础目录骨架 | 新架构目录存在 | 旧模块迁移 | 已完成 |
| 3 | 写基础 contract | branch/stem/palace/birth/lunar | birth 与 foundation | 已完成 |
| 4 | 写星曜 contract | star/placement | catalog 与 placement | 已完成 |
| 5 | 写完整盘 contract | foundation/full-chart/dynamic/page-view/error | full-chart 与 API | 已完成 |
| 6 | 加重复参数检查脚本 | `check-contract-duplicates.mjs` | 后续防止重复定义 | 已完成 |

## 开工约束

1. 先建 `contracts`，再迁移旧代码。
2. 不先做页面，页面等 `FullZiweiChart` 稳定后再做。
3. 不在旧 `ziwei-engine.ts` 里新增任何辅曜、杂曜、四化。
4. 不在 API 或页面里重复定义请求、响应、ViewModel。
5. 每完成一个阶段，都先跑检查脚本或类型检查，再进入下一阶段。

## 当前准备状态

| 项目 | 状态 |
|---|---|
| 架构文档 | 已完成 |
| 目录结构文档 | 已完成 |
| 参数契约文档 | 已完成 |
| 旧模块迁移文档 | 已完成 |
| 页面结构文档 | 已完成 |
| 执行计划表 | 已完成 |
| 代码开工 | 已完成 |
