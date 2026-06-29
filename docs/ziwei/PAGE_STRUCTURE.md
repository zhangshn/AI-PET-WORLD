# 紫微斗数页面结构

版本：v0.2  
状态：页面拆分草案  
更新日期：2026-06-27

## 页面目标

新增 `/ziwei`，第一屏直接是可用排盘工具，不做宣传型落地页。

页面需要展示：

1. 出生信息输入。
2. 十二宫完整盘。
3. 当前选中宫位详情。
4. 星曜总表。
5. 本命、大限、流年、流月、流日、流时切换。
6. 调试 JSON。

## 页面目录

```txt
src/app/ziwei/
  page.tsx

  _components/
    birth-input-panel.tsx
    misc-star-panel.tsx
    dynamic-flow-overview-panel.tsx
    rule-source-overview-panel.tsx
    same-name-star-panel.tsx
    star-category-summary-panel.tsx
    ziwei-chart-grid.tsx
    palace-detail-panel.tsx
    palace-overview-panel.tsx
    star-group-list.tsx
    dynamic-flow-tabs.tsx
    interpretation-panel.tsx
    star-catalog-table.tsx
    debug-json-panel.tsx
    chart-error-panel.tsx

  _lib/
    ziwei-page-view-model.ts
    ziwei-api-client.ts
    ziwei-palace-layout.ts
    ziwei-form-options.ts
    ziwei-misc-star-groups.ts
    ziwei-rule-source-index.ts
    ziwei-same-name-stars.ts
    ziwei-star-category-summary.ts
    ziwei-star-group-filters.ts

  _styles/
    ziwei-page.module.css
```

## 组件职责

| 组件 | 职责 | 禁止 |
|---|---|---|
| `birth-input-panel.tsx` | 收集年月日时、性别、当前日期 | 不直接计算命盘 |
| `misc-star-panel.tsx` | 杂曜专项总览 | 不重新计算杂曜落点、不改写规则来源 |
| `dynamic-flow-overview-panel.tsx` | 动态流完整明细 | 不重新计算动态流落宫、不直接读取 debug JSON |
| `rule-source-overview-panel.tsx` | 规则来源总览与校准索引 | 不解释规则、不读取源码文件 |
| `same-name-star-panel.tsx` | 同名星曜校准 | 不合并星曜、不改写 `starId` 命名空间 |
| `star-category-summary-panel.tsx` | 星曜分类统计 | 不重新定义分类、不修改星曜总表数据 |
| `ziwei-chart-grid.tsx` | 十二宫布局容器 | 不拼接星曜算法 |
| `palace-cell.tsx` | 单宫摘要展示 | 不读取 API |
| `palace-detail-panel.tsx` | 选中宫位详细内容 | 不修改完整盘数据 |
| `palace-overview-panel.tsx` | 十二宫完整明细总览 | 不重复定义星曜分类、不重新计算排盘 |
| `star-group-list.tsx` | 按主星/辅曜/煞曜/杂曜/四化分组展示 | 不决定星曜分类 |
| `dynamic-flow-tabs.tsx` | 本命/大限/流年/流月/流日/流时切换 | 不计算动态盘 |
| `interpretation-panel.tsx` | 展示整盘摘要和当前宫位解释 | 不重新排盘、不写安星规则 |
| `star-catalog-table.tsx` | 全部星曜目录和落宫总表 | 不写安星规则 |
| `debug-json-panel.tsx` | 展示原始 chart/debug JSON | 不参与正式 UI 文案 |

## 页面数据流

```txt
birth-input-panel
-> ziwei-api-client
-> POST /api/ziwei/full-chart
-> ZiweiPageViewModel
-> ziwei-chart-grid / detail-panel / interpretation-panel / star-table / debug-json
```

页面只消费 `ZiweiPageViewModel`，不直接消费底层 `FullZiweiChart`，除非在调试 JSON 面板中展示。

客户端组件导入边界：

1. `"use client"` 文件只允许从 `ziwei-core/contracts` 做 `import type`。
2. `"use client"` 文件禁止 value-import `public-api`、`shared`、`star-placement`、`full-chart`、`dynamic-chart` 等核心排盘模块。
3. 表单下拉、盘面布局这类客户端常量放在页面 `_lib`，例如 `ziwei-form-options.ts`、`ziwei-palace-layout.ts`。
4. 该边界由 `scripts/ziwei/check-client-boundary.mjs` 检查，避免客户端包误拉服务端排盘实现。

## API 目录

```txt
src/app/api/ziwei/full-chart/
  route.ts
```

请求：

```json
{
  "year": 1990,
  "month": 1,
  "day": 1,
  "hour": 8,
  "minute": 0,
  "gender": "male",
  "currentDate": "2026-06-27",
  "ruleSetVersion": "ziwei-full-chart-v1"
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "chart": {},
    "viewModel": {}
  }
}
```

错误响应：

```json
{
  "ok": false,
  "code": "invalid_birth_input",
  "message": "出生信息无效，无法排盘。"
}
```

## ViewModel 拆分

`_lib/ziwei-page-view-model.ts` 输出 `ZiweiPageViewModel`。

类型定义只放在 `src/ai/destiny-core/ziwei-core/contracts/page-view-contract.ts`，页面 `_lib` 只负责把 `FullZiweiChart` 转成这个 ViewModel。

ViewModel 负责：

1. 排序。
2. 分组。
3. UI 标签。
4. 折叠状态默认值。
5. 页面友好的字段名。
6. 解释层展示数据。

ViewModel 不负责：

1. 不计算命宫。
2. 不安放星曜。
3. 不决定四化。

## 宫格展示规则

每个 `palace-cell` 至少展示：

1. 宫名。
2. 地支。
3. 宫干。
4. 命宫/身宫标记。
5. 主星。
6. 辅曜、煞曜、杂曜、四化的数量或折叠摘要。

宫位详情面板展示：

1. 宫位基础信息。
2. 三方四正：对宫、三方地支。
3. 核心星曜：主星、辅曜、煞曜、四化、杂曜。
4. 周期与流系星曜：长生、年系、月系、日时系。
5. 安星调试：使用 `detailLines`，无内容时提示到星曜总表查看规则来源。

十二宫完整明细：

1. `palace-overview-panel.tsx` 使用 `ZiweiPageViewModel.palaceDetails` 一次性展示 12 宫。
2. 每宫展示宫名、宫干地支、命身标记、星曜总数、规则来源数量、关系摘要。
3. 每宫列出核心星曜与周期流系星曜，星曜分组使用 `star-group-list.tsx`。
4. 核心星曜和周期流系分类只在 `ziwei-star-group-filters.ts` 定义一次，详情面板和总览面板共同调用。
5. 点击总览中的宫位会联动当前选中宫位，右侧详情和解释面板跟随更新。

星曜明细：

1. 宫位详情中的每颗星显示星名、分类、星曜 ID、规则来源。
2. 星曜 ID 来自 `ZiweiStarView.starId`。
3. 规则来源来自 `ZiweiStarView.placementRuleId`，只在 `contracts/page-view-contract.ts` 定义一次。
4. 宫格内保持紧凑星名展示，详情面板展示完整星曜明细。

杂曜专项总览：

1. `misc-star-panel.tsx` 单独展示全部杂曜，不依赖用户在总表中手动筛选。
2. 杂曜子类由 `ziwei-misc-star-groups.ts` 根据 `placementRuleId` 前缀统一归类：`misc.romance`、`misc.nobleman`、`misc.solitary`、`misc.punishment`。
3. 面板显示杂曜总数、子类数量、落宫覆盖、规则来源数量。
4. 每颗杂曜显示星名、落宫、星曜 ID、规则来源，方便回到 `RULE_SOURCE_TABLE.md` 校准。
5. 面板按钮只联动星曜总表筛选到 `misc`，不重新排盘、不重复定义杂曜算法。

宫位关系视图：

1. 宫位详情中的本宫、对宫、三方、邻宫统一来自 `ZiweiPalaceRelationView`。
2. `ZiweiPalaceRelationView` 只在 `contracts/page-view-contract.ts` 定义一次，页面组件只渲染 ViewModel。
3. 关系数据由 `page-view-model-builder.ts` 根据 `FullZiweiPalace.oppositeBranch`、`trineBranches` 和相邻地支统一生成。
4. 详情面板不直接拼接 `oppositeBranchLabel` 或 `trineBranchLabels`，避免后续解释层、调试层重复计算关系。

星曜分类统计：

1. `star-category-summary-panel.tsx` 从 `ZiweiPageViewModel.starCatalogRows` 聚合星曜分类统计。
2. `ziwei-star-category-summary.ts` 统计每类星曜数量、落宫覆盖、规则来源数量和宫位列表。
3. 分类统计不重新定义分类，不修改星曜总表数据。
4. 点击分类卡片会联动星曜总表筛选到对应分类。
5. 分类统计用于检查 103 颗星是否覆盖所有星曜分类和十二宫分布。

星曜总表展示：

1. 分类筛选：主星、辅曜、煞曜、四化、杂曜、长生、年系、月系、日时系。
2. 落宫筛选：按宫位和十二宫职能过滤。
3. 规则关键词：按星曜名、星曜 ID、分类、落宫或 `placementRuleId` 搜索。
4. 规则来源：每行显示 `placementRuleId`，页面不在总表中重新解释规则。

规则来源总览：

1. `rule-source-overview-panel.tsx` 从 `ZiweiPageViewModel.starCatalogRows` 聚合规则来源索引。
2. `ziwei-rule-source-index.ts` 按星曜分类和 `placementRuleId` 聚合，不读取源码文件、不重新解释安星口诀。
3. 每条规则显示规则 ID、覆盖星曜、落宫覆盖和出现次数。
4. 点击分类标题会联动星曜总表筛选到对应分类，方便回到明细行继续校准。
5. 规则来源总览用于校准索引；正式规则说明仍以 `RULE_SOURCE_TABLE.md` 为准。

同名星曜校准：

1. `same-name-star-panel.tsx` 从 `ZiweiPageViewModel.starCatalogRows` 找出显示名称相同但 `starId` 不同的星曜。
2. `ziwei-same-name-stars.ts` 只做页面索引，不合并星曜、不改写 `starId` 命名空间。
3. 每组显示同名星曜的分类、落宫、星曜 ID、规则来源。
4. 当前用于校准天巫、咸池等同名跨分组条目，最终是否合并以后按 `RULE_SOURCE_TABLE.md` 处理。
5. 点击同名记录的分类会联动星曜总表筛选到该分类。

动态流展示：

1. 行运方向：从动态盘 `debug.direction` 转成中文。
2. 起运岁数：来自动态盘 `debug.startAge`。
3. 当前年龄：来自动态盘 `debug.currentAge`。
4. 启用流数量：统计本命、大限、流年、流月、流日、流时的启用状态。
5. 六流按钮：每个动态流显示命宫落点、启用状态、未启用原因。

动态流完整明细：

1. `dynamic-flow-overview-panel.tsx` 使用 `ZiweiPageViewModel.dynamicFlowDetails` 展示本命、大限、流年、流月、流日、流时。
2. 每个动态流显示启用状态、落宫地支、宫位、影响权重、星曜数量、规则来源数量。
3. 每个动态流复用对应宫位的 `palaceDetail.starGroups` 展示星曜摘要，不重新计算星曜。
4. 点击动态流明细卡会联动当前动态流、盘面选中宫位、右侧详情和解释。
5. 未起运的大限保留 `inactiveReason`，页面只展示 ViewModel 文案。

解释层展示：

1. 整盘摘要：展示 `chartHighlights`，并显示解释生成器和摘要条数。
2. 当前宫位解释：只展示当前选中宫位的 `palaceInterpretations` 条目。
3. 规则来源追踪：聚合当前宫位解释项的 `sourceRuleIds`，方便回到规则来源表校准。
4. 页面不重新排盘，不在解释组件中重新定义出生、宫位或星曜参数。

调试 JSON 展示：

1. 盘面摘要：显示规则版本、十二宫数量、星曜总数、分类数量、命身宫、警告数量、动态流数量。
2. 完整本命盘：显示 `debugJson.chart` 原始结构。
3. 动态盘：显示 `debugJson.dynamicChart` 原始结构。
4. 调试面板只用于校验，不作为正式解读文案来源。

## 十二宫盘面位置

页面十二宫采用 4 × 4 外圈盘，中间为中宫：

```txt
巳  午  未  申
辰  中宫    酉
卯          戌
寅  丑  子  亥
```

对应外圈顺序：

```txt
寅 -> 卯 -> 辰 -> 巳 -> 午 -> 未 -> 申 -> 酉 -> 戌 -> 亥 -> 子 -> 丑
```

实现位置：

```txt
src/app/ziwei/_lib/ziwei-palace-layout.ts
src/app/ziwei/_components/ziwei-chart-grid.tsx
src/app/ziwei/_styles/ziwei-page.module.css
```

`ziwei-palace-layout.ts` 是地支到盘面区域、桌面行列、移动端行列的唯一 TS 参数来源；组件把它格式化为 CSS 变量，样式文件只读取变量。中宫只做摘要展示，不参与安星计算。

中宫展示内容：

1. 当前选中宫位。
2. 当前宫位星曜分组数。
3. 全盘星曜总数。
4. 出生输入摘要。
5. 规则版本。
6. 命宫、身宫地支。

布局检查脚本：

```bash
node scripts/ziwei/check-page-layout.mjs
node scripts/ziwei/check-client-boundary.mjs
node scripts/ziwei/check-palace-detail-layout.mjs
node scripts/ziwei/check-star-catalog-table.mjs
node scripts/ziwei/check-dynamic-flow-panel.mjs
node scripts/ziwei/check-dynamic-flow-overview-panel.mjs
node scripts/ziwei/check-interpretation-panel-layout.mjs
node scripts/ziwei/check-debug-json-panel.mjs
node scripts/ziwei/check-star-detail-view.mjs
node scripts/ziwei/check-palace-relation-view.mjs
node scripts/ziwei/check-palace-overview-panel.mjs
node scripts/ziwei/check-misc-star-panel.mjs
node scripts/ziwei/check-rule-source-overview-panel.mjs
node scripts/ziwei/check-same-name-star-panel.mjs
node scripts/ziwei/check-star-category-summary-panel.mjs
```

## 样式边界

1. 十二宫格固定结构，不能因为星曜多寡撑坏布局。
2. 星曜过多时在单宫内折叠，详情面板显示完整列表。
3. 桌面端优先：左侧宫格，右侧详情。
4. 移动端：宫格在上，详情和 Tabs 在下。
5. 不把全部星曜文本直接堆在一个宫格里。
