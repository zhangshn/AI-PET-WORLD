# 紫微斗数参数契约

版本：v0.1  
状态：参数单一来源规则  
更新日期：2026-06-27

## 核心要求

所有跨模块参数只定义一次，统一放在：

```txt
src/ai/destiny-core/ziwei-core/contracts/
```

后续算法、API、页面、脚本都只能 import，不允许重复声明同名结构。

## 契约目录

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

## 文件职责

| 文件 | 唯一定义内容 |
|---|---|
| `branch-contract.ts` | `BranchPalace`、地支相关类型 |
| `stem-contract.ts` | `HeavenlyStem`、天干相关类型 |
| `palace-contract.ts` | `SectorName`、宫位顺序相关类型 |
| `birth-contract.ts` | `ZiweiBirthInput`、`NormalizedZiweiBirthInput`、性别、历法类型 |
| `lunar-contract.ts` | `LunarBirthInfo`、农历年月日、时辰、干支结果 |
| `foundation-contract.ts` | `ZiweiNatalFoundation`、五行局、宫干映射 |
| `star-contract.ts` | `ZiweiStarId`、`ZiweiStarCategory`、`ZiweiStarDefinition` |
| `placement-contract.ts` | `ZiweiPlacementContext`、`ZiweiPlacedStar`、安星规则 ID |
| `full-chart-contract.ts` | `FullZiweiChart`、`FullZiweiPalace`、宫位星曜分组 |
| `dynamic-chart-contract.ts` | 大限、流年、流月、流日、流时结构 |
| `interpretation-contract.ts` | `ZiweiChartInterpretation`、`ZiweiPalaceInterpretation`、解释项结构 |
| `page-view-contract.ts` | `ZiweiPageViewModel` 和页面展示结构 |
| `error-contract.ts` | API 错误码、统一响应结构 |
| `index.ts` | 统一导出所有契约 |

## 调用规则

正确：

```ts
import type {
  FullZiweiChart,
  NormalizedZiweiBirthInput,
  ZiweiPlacedStar
} from "../contracts"
```

错误：

```ts
// 不允许在 full-chart/full-chart-engine.ts 里重新定义。
interface FullZiweiChart {
  palaces: unknown[]
}
```

## 允许本地定义的内容

模块内部可以定义私有 helper 参数，但必须满足两个条件：

1. 不 export。
2. 不被其他目录调用。

示例：

```ts
interface BuildPalaceGroupParams {
  branch: BranchPalace
  stars: ZiweiPlacedStar[]
}
```

如果这个参数后续被两个以上目录使用，就必须移动到 `contracts`。

## 禁止重复定义清单

这些名字只能在 `contracts` 定义：

1. `BranchPalace`
2. `TimeBranch`
3. `HeavenlyStem`
4. `SectorName`
5. `ElementGate`
6. `ZiweiBirthInput`
7. `NormalizedZiweiBirthInput`
8. `LunarBirthInfo`
9. `ZiweiNatalFoundation`
10. `ZiweiStarId`
11. `ZiweiStarCategory`
12. `ZiweiStarDefinition`
13. `ZiweiPlacementContext`
14. `ZiweiPlacedStar`
15. `FullZiweiChart`
16. `FullZiweiPalace`
17. `FullZiweiDynamicChart`
18. `ZiweiPageViewModel`
19. `ZiweiApiResponse`
20. `ZiweiApiErrorCode`
21. `ZiweiChartInterpretation`
22. `ZiweiInterpretationItem`
23. `ZiweiPalaceInterpretation`
24. `ZiweiInterpretationScope`

## 迁移旧结构

旧文件里已有这些类型：

```txt
src/ai/destiny-core/ziwei-core/ziwei-core-schema.ts
```

迁移策略：

1. 第一阶段不直接删除旧 schema，避免破坏人格层。
2. 新完整盘使用 `contracts`。
3. `adapters/legacy-birth-pattern-adapter.ts` 负责新旧结构转换。
4. 等完整盘稳定后，再评估是否把旧 schema 改成 re-export。

## API 和页面规则

API route 不定义请求/响应类型，必须 import：

```ts
import type {
  ZiweiFullChartRequest,
  ZiweiApiResponse
} from "@/ai/destiny-core/ziwei-core/contracts"
```

页面 `_lib` 不定义 ViewModel 类型，必须 import：

```ts
import type {
  ZiweiPageViewModel,
  ZiweiPalaceCellView
} from "@/ai/destiny-core/ziwei-core/contracts"
```

## 检查脚本

后续新增：

```txt
scripts/ziwei/check-contract-duplicates.mjs
```

检查内容：

1. 禁止清单里的类型名是否在 `contracts` 之外 export。
2. API 是否重复定义 request/response。
3. 页面是否重复定义 ViewModel。
4. star-placement 是否重复定义 `ZiweiPlacedStar`。
