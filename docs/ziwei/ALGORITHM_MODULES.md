# 紫微斗数算法模块拆分

版本：v0.2  
状态：算法拆分草案  
更新日期：2026-06-27

## 总数据流

```txt
BirthInput
-> NormalizedZiweiBirthInput
-> LunarBirthInfo
-> ZiweiNatalFoundation
-> ZiweiPlacementContext
-> ZiweiPlacedStar[]
-> FullZiweiChart
-> ZiweiPageViewModel
```

这些类型都只在 `src/ai/destiny-core/ziwei-core/contracts` 定义。算法目录只 import type，不重复声明。

## 1. 输入标准化

目录：`src/ai/destiny-core/ziwei-core/birth`

输出：

参数类型：`NormalizedZiweiBirthInput`，定义位置是 `contracts/birth-contract.ts`。

职责：

1. 填补 `minute` 默认值。
2. 判断时辰。
3. 输出农历年月日、年干、时支。
4. 不计算命宫，不安星。

## 2. 本命地基

目录：`src/ai/destiny-core/ziwei-core/natal-foundation`

输出：

参数类型：`ZiweiNatalFoundation`，定义位置是 `contracts/foundation-contract.ts`。

职责：

1. 命宫、身宫。
2. 十二宫逆排。
3. 五虎遁宫干。
4. 命宫干支纳音五行局。
5. 对宫与三方四正工具。

不做：

1. 不放辅曜、杂曜。
2. 不生成人格解释。
3. 不生成页面用的宫格文案。

## 3. 安星上下文

目录：`src/ai/destiny-core/ziwei-core/star-placement`

参数类型：`ZiweiPlacementContext`，定义位置是 `contracts/placement-contract.ts`。

所有安星器只接受 `ZiweiPlacementContext`，只返回 `ZiweiPlacedStar[]`。

## 4. 主星安放

目录：`star-placement/main-stars`

拆分：

| 文件 | 职责 |
|---|---|
| `ziwei-star.ts` | 根据农历日和五行局计算紫微星位置 |
| `tianfu-star.ts` | 根据紫微位置计算天府位置 |
| `ziwei-system.ts` | 紫微系：紫微、天机、太阳、武曲、天同、廉贞 |
| `tianfu-system.ts` | 天府系：天府、太阴、贪狼、巨门、天相、天梁、七杀、破军 |
| `main-star-placement.ts` | 汇总 14 主星 |

输出必须包含 14 颗主星，校验器要检查重复和遗漏。

## 5. 辅曜安放

目录：`star-placement/assistant-stars`

拆分：

| 文件 | 星曜 |
|---|---|
| `left-right.ts` | 左辅、右弼 |
| `chang-qu.ts` | 文昌、文曲 |
| `kui-yue.ts` | 天魁、天钺 |
| `lucun-tianma.ts` | 禄存、天马 |
| `assistant-star-placement.ts` | 汇总辅曜 |

原则：按安星依据拆，不按“好星坏星”混在一起。

## 6. 煞曜安放

目录：`star-placement/malefic-stars`

拆分：

| 文件 | 星曜 |
|---|---|
| `qingyang-tuoluo.ts` | 擎羊、陀罗 |
| `huoxing-lingxing.ts` | 火星、铃星 |
| `dikong-dijie.ts` | 地空、地劫 |
| `malefic-star-placement.ts` | 汇总煞曜 |

## 7. 四化

目录：`star-placement/transformations`

拆分：

| 文件 | 职责 |
|---|---|
| `transformation-rules.ts` | 化禄、化权、化科、化忌规则表 |
| `natal-four-transformations.ts` | 本命年干四化 |
| `dynamic-four-transformations.ts` | 大限/流年/流月等动态四化 |
| `transformation-placement.ts` | 汇总四化 |

四化不是普通星曜，页面可以展示在星曜列表里，但数据结构要保留 `targetStarId`。

## 8. 杂曜

目录：`star-placement/misc-stars`

不要把全部杂曜写进一个文件，至少按语义和安星依据拆：

| 文件 | 示例 |
|---|---|
| `romance-stars.ts` | 红鸾、天喜、咸池、天姚 |
| `nobleman-stars.ts` | 台辅、封诰、龙池、凤阁、天巫 |
| `solitary-stars.ts` | 孤辰、寡宿 |
| `punishment-stars.ts` | 天刑、破碎、阴煞、天哭、天虚 |
| `misc-star-placement.ts` | 汇总杂曜 |

第一版可以先建目录和 catalog，再逐步补算法。

## 9. 长生与年系星曜

目录：

```txt
star-placement/lifecycle-stars/
star-placement/annual-stars/
```

长生十二神：

```txt
长生、沐浴、冠带、临官、帝旺、衰、病、死、墓、绝、胎、养
```

年系星曜：

```txt
博士十二神、岁前十二神、将前十二神
```

这两类信息量大，必须独立目录，不放进 `misc-stars`。

## 10. 月日时系星曜

目录：

```txt
star-placement/monthly-stars/
star-placement/daily-hourly-stars/
```

职责：

1. 按农历月安星。
2. 按农历日安星。
3. 按时辰安星。

后续如果某些杂曜依赖月、日、时，也放在这里对应目录，不塞回 `misc-stars`。

## 11. 完整盘组装

目录：`src/ai/destiny-core/ziwei-core/full-chart`

流程：

```txt
foundation + placedStars
-> 按 branch 分组
-> 转成十二宫 palaces
-> 按 category 分组
-> 排序
-> 补对宫、三方四正、借宫
-> 生成 summary/debug
```

输出：

参数类型：`FullZiweiChart`，定义位置是 `contracts/full-chart-contract.ts`。

## 12. 校验

`full-chart-validator.ts` 至少检查：

1. 十二宫数量必须是 12。
2. 每个地支必须出现一次。
3. 每个宫位必须有宫名、地支、宫干。
4. 主星必须 14 颗且不重复。
5. 所有星曜必须在 `star-catalog` 中注册。
6. 所有星曜必须有 `placementRuleId`。
7. 页面显示分组不能遗漏星曜分类。
