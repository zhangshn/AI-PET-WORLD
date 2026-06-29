# 紫微斗数目录结构

版本：v0.2  
状态：目标目录结构  
更新日期：2026-06-27

## 总体目录

```txt
src/
  ai/
    destiny-core/
      ziwei-core/
        contracts/
        shared/
        birth/
        natal-foundation/
        star-catalog/
        star-placement/
        full-chart/
        dynamic-chart/
        interpretation/
        adapters/
        public-api/

  app/
    ziwei/
      _components/
      _lib/
      _styles/
      page.tsx
    api/
      ziwei/
        full-chart/
          route.ts

data/
  ziwei/
    golden-samples/

scripts/
  ziwei/
```

## `ziwei-core/contracts`

只放跨模块参数、类型、枚举，是紫微完整盘唯一参数定义源。

```txt
contracts/
  branch-contract.ts
  stem-contract.ts
  palace-contract.ts
  birth-contract.ts
  lunar-contract.ts
  foundation-contract.ts
  star-contract.ts
  placement-contract.ts
  full-chart-contract.ts
  dynamic-chart-contract.ts
  interpretation-contract.ts
  page-view-contract.ts
  error-contract.ts
  index.ts
```

放这里：

1. `BranchPalace`、`HeavenlyStem`、`SectorName` 等基础枚举类型。
2. `ZiweiBirthInput`、`NormalizedZiweiBirthInput`。
3. `LunarBirthInfo`。
4. `ZiweiNatalFoundation`。
5. `ZiweiStarId`、`ZiweiStarCategory`、`ZiweiStarDefinition`。
6. `ZiweiPlacementContext`、`ZiweiPlacedStar`。
7. `FullZiweiChart`、`FullZiweiPalace`。
8. `FullZiweiDynamicChart`。
9. `ZiweiPageViewModel`。
10. API 错误码和统一响应结构。

禁止：

1. 禁止写算法。
2. 禁止写 React 组件。
3. 禁止读取文件或调用 API。
4. 禁止在其他目录重新定义同名跨模块参数。

调用规则：

```ts
import type {
  NormalizedZiweiBirthInput,
  ZiweiPlacementContext,
  FullZiweiChart
} from "../contracts"
```

## `ziwei-core/shared`

只放基础常量和通用工具。

```txt
shared/
  branch-order.ts
  branch-utils.ts
  stem-utils.ts
  palace-order.ts
  mod-utils.ts
  labels.ts
```

放这里：

1. 地支顺序、天干顺序。
2. `moveBranch`、`getOppositeBranch`、`safeModulo`。
3. 宫位顺序、中文标签。

不放这里：

1. 不放星曜定义。
2. 不放安星规则。
3. 不放页面展示结构。

## `ziwei-core/birth`

只处理出生输入和农历信息。

```txt
birth/
  birth-input-normalizer.ts
  lunar-adapter.ts
  time-branch-resolver.ts
  ganzhi-resolver.ts
```

职责：

1. 标准化公历/农历输入。
2. 解析时辰。
3. 输出 `LunarBirthInfo` 或后续完整盘输入。

## `ziwei-core/natal-foundation`

只计算本命盘地基，不安放全量星曜。

```txt
natal-foundation/
  life-body-palace.ts
  palace-sequence.ts
  palace-stems.ts
  element-gate.ts
  borrowed-palace.ts
  natal-foundation-engine.ts
```

职责：

1. 命宫、身宫。
2. 十二宫顺序。
3. 宫干。
4. 五行局。
5. 空宫与借宫基础信息。

## `ziwei-core/star-catalog`

只放星曜资料，不放安星算法。

```txt
star-catalog/
  main-star-catalog.ts
  assistant-star-catalog.ts
  malefic-star-catalog.ts
  transformation-star-catalog.ts
  misc-star-catalog.ts
  lifecycle-star-catalog.ts
  yearly-star-catalog.ts
  monthly-star-catalog.ts
  daily-hourly-star-catalog.ts
  star-display-groups.ts
  star-catalog.ts
```

职责：

1. 星曜 ID。
2. 中文名。
3. 分类。
4. 页面显示顺序。
5. 是否启用。

禁止：

1. 禁止在 catalog 里写“怎么安星”。
2. 禁止在 catalog 里读取出生日期。

## `ziwei-core/star-placement`

只放安星算法，并按星曜来源拆目录。

```txt
star-placement/
  placement-context.ts
  placement-pipeline.ts

  main-stars/
    ziwei-star.ts
    tianfu-star.ts
    ziwei-system.ts
    tianfu-system.ts
    main-star-placement.ts

  assistant-stars/
    left-right.ts
    chang-qu.ts
    kui-yue.ts
    lucun-tianma.ts
    assistant-star-placement.ts

  malefic-stars/
    qingyang-tuoluo.ts
    huoxing-lingxing.ts
    dikong-dijie.ts
    malefic-star-placement.ts

  transformations/
    transformation-rules.ts
    natal-four-transformations.ts
    dynamic-four-transformations.ts
    transformation-placement.ts

  misc-stars/
    romance-stars.ts
    nobleman-stars.ts
    solitary-stars.ts
    punishment-stars.ts
    misc-star-placement.ts

  lifecycle-stars/
    changsheng-cycle.ts
    boshi-cycle.ts
    lifecycle-star-placement.ts

  annual-stars/
    suiqian-stars.ts
    jiangqian-stars.ts
    annual-star-placement.ts

  monthly-stars/
    monthly-star-placement.ts

  daily-hourly-stars/
    daily-star-placement.ts
    hourly-star-placement.ts
    daily-hourly-star-placement.ts
```

职责：

1. 每个文件只处理同一组星曜。
2. 每个安星函数返回 `ZiweiPlacedStar[]`。
3. 每颗星必须带 `placementRuleId`。
4. 所有安星器由 `placement-pipeline.ts` 串联。

禁止：

1. 禁止一个 `misc-stars.ts` 塞全部杂曜算法。
2. 禁止安星器直接生成页面文案。
3. 禁止在安星器里修改人格层 `BirthPattern`。

## `ziwei-core/full-chart`

只负责完整盘组装和校验。

```txt
full-chart/
  palace-star-groups.ts
  palace-detail-builder.ts
  full-chart-engine.ts
  full-chart-validator.ts
  full-chart-debug-builder.ts
  full-chart-summary.ts
```

职责：

1. 把本命地基和安星结果合成 12 宫。
2. 把星曜按宫位、分类、显示顺序整理好。
3. 生成调试信息。
4. 校验是否缺宫、缺主星、重复星曜、未分类星曜。

## `ziwei-core/dynamic-chart`

只负责动态盘，不和本命盘安星混在一起。

```txt
dynamic-chart/
  cycle-direction.ts
  da-yun-chart.ts
  liu-nian-chart.ts
  liu-yue-chart.ts
  liu-ri-chart.ts
  liu-shi-chart.ts
  dynamic-chart-engine.ts
  dynamic-chart-summary.ts
```

职责：

1. 大限、流年、流月、流日、流时盘。
2. 动态命宫重排。
3. 动态四化入口。
4. 动态盘页面 ViewModel 的基础数据。

## `ziwei-core/interpretation`

只负责解释层数据组装，不重新排盘，不重复定义输入参数。

```txt
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
```

职责：

1. 把 `FullZiweiChart` 转换为 `ZiweiChartInterpretation`。
2. 按宫位聚合星曜解释项。
3. 保留 `sourceRuleIds`，让每条解释能追溯到安星规则。
4. 给页面提供轻量、可校准的解释提示。

禁止：

1. 禁止在解释层重新计算星曜落点。
2. 禁止在解释层重新声明出生参数、宫位参数、星曜参数。
3. 禁止把长篇断语写入排盘算法。

## `ziwei-core/adapters`

只做兼容适配。

```txt
adapters/
  legacy-birth-pattern-adapter.ts
  personality-profile-adapter.ts
  public-view-adapter.ts
```

职责：

1. 让旧人格层继续使用 `BirthPattern`。
2. 让完整盘和人格映射解耦。
3. 处理旧 `star_01` 这种 ID 与新语义星曜 ID 的对应。

## `ziwei-core/public-api`

只放对外入口。

```txt
public-api/
  build-full-ziwei-chart.ts
  build-ziwei-interpretation.ts
  build-ziwei-page-view-model.ts
  index.ts
```

职责：

1. 页面/API 只从这里调用。
2. 屏蔽内部目录拆分。
3. 禁止页面越级调用 `star-placement/*`。

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
    palace-cell.tsx
    palace-detail-panel.tsx
    palace-overview-panel.tsx
    star-group-list.tsx
    dynamic-flow-tabs.tsx
    interpretation-panel.tsx
    star-catalog-table.tsx
    debug-json-panel.tsx
  _lib/
    ziwei-palace-layout.ts
    ziwei-form-options.ts
    ziwei-misc-star-groups.ts
    ziwei-rule-source-index.ts
    ziwei-same-name-stars.ts
    ziwei-star-category-summary.ts
    ziwei-star-group-filters.ts
    ziwei-page-view-model.ts
    ziwei-api-client.ts
  _styles/
    ziwei-page.module.css
```

## 数据与脚本

```txt
data/ziwei/
  golden-samples/
    sample-1990-01-01-0800.json
    sample-coverage-report.json

scripts/ziwei/
  inspect-full-chart.mjs
  check-star-catalog.mjs
  check-star-placement-coverage.mjs
  check-interpretation.mjs
  check-page-view-model.mjs
  check-palace-detail-layout.mjs
  check-star-catalog-table.mjs
  check-dynamic-flow-panel.mjs
  check-dynamic-flow-overview-panel.mjs
  check-interpretation-panel-layout.mjs
  check-debug-json-panel.mjs
  check-star-detail-view.mjs
  check-palace-relation-view.mjs
  check-palace-overview-panel.mjs
  check-misc-star-panel.mjs
  check-rule-source-overview-panel.mjs
  check-same-name-star-panel.mjs
  check-star-category-summary-panel.mjs
```

## 最重要的拆分规则

1. `contracts` 管参数定义，其他目录只 import，不重复定义。
2. `birth` 管输入处理，不重复声明输入类型。
3. `natal-foundation` 管宫位地基，不管辅曜杂曜。
4. `star-catalog` 管星曜资料，不管计算。
5. `star-placement` 管星曜落点，不管页面。
6. `full-chart` 管盘面组装，不管 React。
7. `dynamic-chart` 管动态流，不污染本命盘。
8. `interpretation` 管解释层数据，不重新排盘。
9. `adapters` 管旧系统兼容，不让旧结构限制新完整盘。
10. `app/ziwei` 管 UI，只读 ViewModel。
