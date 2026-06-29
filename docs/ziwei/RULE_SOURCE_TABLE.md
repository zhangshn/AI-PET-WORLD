# 紫微斗数规则来源与校准表

版本：v0.1  
状态：规则口径盘点  
更新日期：2026-06-28

## 目的

这份文档只记录「安星规则口径」和「代码落点」，不重新定义参数类型。

参数定义仍以 `src/ai/destiny-core/ziwei-core/contracts/*` 为唯一来源；本表只用于：

1. 确认每个 `placementRuleId` 有文档记录。
2. 标记当前采用的算法口径。
3. 标记流派差异和待校准项。
4. 给页面调试信息、回归样例、后续解释层提供规则索引。

## 外部参照

| 来源 | 用途 | 备注 |
|---|---|---|
| [iztro 安星诀](https://iztro.com/learn/setup) | 主星、辅曜、煞曜、杂曜、长生、博士、岁前、将前等口径参照 | 作为当前工程的主要对照资料之一 |
| [星侨五术 108s 紫微资料](https://www.108s.tw/article/info/101) | 常见星曜与安星口径参照 | 用于交叉比对年系、杂曜等条目 |

## 状态定义

| 状态 | 含义 |
|---|---|
| 已实现 | 当前代码已有可运行算法，并已进入完整盘 |
| 已对齐旧模块 | 新实现与旧模块或旧样例输出一致 |
| 待校准 | 规则可能存在流派差异，需要后续和指定资料或人工样例确认 |
| 待扩展 | 当前已留结构，但星曜数量或动态派生尚未完全扩展 |

## 基础盘

| 规则编号 | 星曜/模块 | 当前口径 | 输入依赖 | 代码位置 | 状态 | 待校准点 |
|---|---|---|---|---|---|---|
| `main.ziwei-system` | 紫微系六星 | 先定紫微星，再按紫微系固定偏移安天机、太阳、武曲、天同、廉贞 | 农历日、五行局、十二地支 | `star-placement/main-stars/ziwei-system.ts` | 已实现 | 紫微起例表需继续和更多样例交叉 |
| `main.tianfu-system` | 天府系八星 | 由紫微位置定天府，再按天府系固定偏移安太阴、贪狼、巨门、天相、天梁、七杀、破军 | 紫微星位置 | `star-placement/main-stars/tianfu-system.ts` | 已实现 | 天府对照位置需更多样例覆盖 |
| `transformation.natal.year-stem` | 生年四化 | 以生年天干查四化表，并绑定目标主星 | 年干、已落主星 | `star-placement/transformations/transformation-placement.ts` | 已实现 | 四化表存在流派差异时需版本化 |

## 辅曜

| 规则编号 | 星曜/模块 | 当前口径 | 输入依赖 | 代码位置 | 状态 | 待校准点 |
|---|---|---|---|---|---|---|
| `assistant.left-right.lunar-month` | 左辅、右弼 | 左辅从辰按农历月顺行；右弼从戌按农历月逆行 | 农历月 | `star-placement/assistant-stars/left-right.ts` | 已实现 | 起点和顺逆需用样例锁定 |
| `assistant.chang-qu.time-branch` | 文昌、文曲 | 文昌从戌按时支逆行；文曲从辰按时支顺行 | 时支 | `star-placement/assistant-stars/chang-qu.ts` | 已实现 | 子时边界样例需补 |
| `assistant.kui-yue.year-stem` | 天魁、天钺 | 以生年天干查表 | 年干 | `star-placement/assistant-stars/kui-yue.ts` | 已实现 | 天魁天钺表需和指定流派确认 |
| `assistant.lucun.year-stem` | 禄存 | 以生年天干查禄存落支 | 年干 | `star-placement/assistant-stars/lucun-tianma.ts` | 已实现 | 无 |
| `assistant.tianma.year-branch` | 天马 | 以生年地支三合组查天马落支 | 年支 | `star-placement/assistant-stars/lucun-tianma.ts` | 已实现 | 三合组口径需样例覆盖 |

## 煞曜

| 规则编号 | 星曜/模块 | 当前口径 | 输入依赖 | 代码位置 | 状态 | 待校准点 |
|---|---|---|---|---|---|---|
| `malefic.qingyang-tuoluo.lucun-neighbors` | 擎羊、陀罗 | 以禄存为基准，前后邻宫安擎羊、陀罗 | 年干、禄存位置 | `star-placement/malefic-stars/qingyang-tuoluo.ts` | 已实现 | 前后方向需要样例锁定 |
| `malefic.huoxing-lingxing.year-branch-time` | 火星、铃星 | 以年支组确定起点，再按时支推移 | 年支、时支 | `star-placement/malefic-stars/huoxing-lingxing.ts` | 已实现 | 起点表流派差异较常见，待校准 |
| `malefic.dikong-dijie.time-branch` | 地空、地劫 | 以时支从固定起点顺逆推移 | 时支 | `star-placement/malefic-stars/dikong-dijie.ts` | 已实现 | 起点与顺逆需样例覆盖 |

## 杂曜

| 规则编号 | 星曜/模块 | 当前口径 | 输入依赖 | 代码位置 | 状态 | 待校准点 |
|---|---|---|---|---|---|---|
| `misc.romance.hongluan.year-branch` | 红鸾 | 以年支从卯逆推 | 年支 | `star-placement/misc-stars/romance-stars.ts` | 已实现 | 无 |
| `misc.romance.tianxi.opposite-hongluan` | 天喜 | 红鸾对宫 | 红鸾位置 | `star-placement/misc-stars/romance-stars.ts` | 已实现 | 无 |
| `misc.romance.xianchi.year-branch-group` | 咸池 | 以年支三合组查表 | 年支 | `star-placement/misc-stars/romance-stars.ts` | 已实现 | 与将前咸池同名但不同分组，页面需区分 |
| `misc.romance.tianyao.lunar-month` | 天姚 | 从丑按农历月顺行 | 农历月 | `star-placement/misc-stars/romance-stars.ts` | 已实现 | 起点需样例覆盖 |
| `misc.nobleman.taifu.time-branch` | 台辅 | 从午按时支顺行 | 时支 | `star-placement/misc-stars/nobleman-stars.ts` | 已实现 | 无 |
| `misc.nobleman.fenggao.time-branch` | 封诰 | 从寅按时支顺行 | 时支 | `star-placement/misc-stars/nobleman-stars.ts` | 已实现 | 无 |
| `misc.nobleman.longchi.year-branch` | 龙池 | 从辰按年支顺行 | 年支 | `star-placement/misc-stars/nobleman-stars.ts` | 已实现 | 无 |
| `misc.nobleman.fengge.year-branch` | 凤阁 | 从戌按年支逆行 | 年支 | `star-placement/misc-stars/nobleman-stars.ts` | 已实现 | 无 |
| `misc.nobleman.tianwu.lunar-month` | 天巫 | 按农历月查表 | 农历月 | `star-placement/misc-stars/nobleman-stars.ts` | 已实现 | 与月系天巫重复命名，后续需确认是否保留双分组或合并 |
| `misc.solitary.guchen-guasu.year-branch-group` | 孤辰、寡宿 | 以年支四组查孤辰、寡宿 | 年支 | `star-placement/misc-stars/solitary-stars.ts` | 已实现 | 无 |
| `misc.punishment.tianxing.lunar-month` | 天刑 | 从酉按农历月顺行 | 农历月 | `star-placement/misc-stars/punishment-stars.ts` | 已实现 | 起点需样例覆盖 |
| `misc.punishment.posui.year-branch-group` | 破碎 | 以年支组查表 | 年支 | `star-placement/misc-stars/punishment-stars.ts` | 已实现 | 无 |
| `misc.punishment.tianku-tianxu.year-branch` | 天哭、天虚 | 以午为起点按年支顺逆安天虚、天哭 | 年支 | `star-placement/misc-stars/punishment-stars.ts` | 已实现 | 顺逆命名需样例校验 |

## 长生与年系

| 规则编号 | 星曜/模块 | 当前口径 | 输入依赖 | 代码位置 | 状态 | 待校准点 |
|---|---|---|---|---|---|---|
| `lifecycle.changsheng.element-gate-direction` | 长生十二神 | 按五行局确定长生起宫，再按阳男阴女顺行、阴男阳女逆行 | 五行局、年干阴阳、性别 | `star-placement/lifecycle-stars/changsheng-cycle.ts` | 已实现 | 长生起宫表需更多样例覆盖 |
| `yearly.boshi.lucun-direction` | 博士十二神 | 博士从禄存起，按阳男阴女顺行、阴男阳女逆行 | 禄存位置、年干、性别 | `star-placement/annual-stars/boshi-cycle.ts` | 已实现 | 顺逆口径需样例覆盖 |
| `yearly.suiqian.year-branch-forward` | 岁前十二神 | 岁建从生年地支起，十二神顺行 | 年支 | `star-placement/annual-stars/suiqian-cycle.ts` | 已实现 | 无 |
| `yearly.jiangqian.trine-start-forward` | 将前十二神 | 以年支三合组定将星起点，再十二神顺行 | 年支 | `star-placement/annual-stars/jiangqian-cycle.ts` | 已实现 | 三合起点需更多样例覆盖 |

## 月系与日时系

| 规则编号 | 星曜/模块 | 当前口径 | 输入依赖 | 代码位置 | 状态 | 待校准点 |
|---|---|---|---|---|---|---|
| `monthly.yuejie.lunar-month` | 月解 | 按农历月查表 | 农历月 | `star-placement/monthly-stars/month-based-stars.ts` | 已实现 | 月解表需样例确认 |
| `monthly.tianwu.lunar-month` | 天巫 | 按农历月查表 | 农历月 | `star-placement/monthly-stars/month-based-stars.ts` | 已实现 | 与杂曜天巫重复命名，待校准 |
| `monthly.tianyue.lunar-month` | 天月 | 按农历月查表 | 农历月 | `star-placement/monthly-stars/month-based-stars.ts` | 已实现 | 天月表需样例确认 |
| `monthly.yinsha.lunar-month` | 阴煞 | 按农历月查表 | 农历月 | `star-placement/monthly-stars/month-based-stars.ts` | 已实现 | 阴煞表需样例确认 |
| `daily-hourly.santai.zuofu-lunar-day-forward` | 三台 | 从左辅按农历日顺行 | 左辅位置、农历日 | `star-placement/daily-hourly-stars/assistant-derived-stars.ts` | 已实现 | 农历日偏移是否从当日算 0 需样例确认 |
| `daily-hourly.bazuo.youbi-lunar-day-backward` | 八座 | 从右弼按农历日逆行 | 右弼位置、农历日 | `star-placement/daily-hourly-stars/assistant-derived-stars.ts` | 已实现 | 农历日偏移需样例确认 |
| `daily-hourly.enguang.wenchang-lunar-day-minus-one` | 恩光 | 从文昌按农历日推移并减一位 | 文昌位置、农历日 | `star-placement/daily-hourly-stars/assistant-derived-stars.ts` | 已实现 | “生日退一位”口径需样例确认 |
| `daily-hourly.tiangui.wenqu-lunar-day-minus-one` | 天贵 | 从文曲按农历日推移并减一位 | 文曲位置、农历日 | `star-placement/daily-hourly-stars/assistant-derived-stars.ts` | 已实现 | “生日退一位”口径需样例确认 |

## 动态层

动态层不产生 `placementRuleId`，但会影响页面切换和回归样例。

| 模块 | 当前口径 | 输入依赖 | 代码位置 | 状态 | 待校准点 |
|---|---|---|---|---|---|
| 大限 | 五行局数作为起运岁数，按阳男阴女顺行、阴男阳女逆行，每十年移一宫 | 五行局、年干、性别、当前年龄 | `dynamic-chart/dynamic-flow-palaces.ts` | 已对齐旧模块 | 起运虚岁/实岁口径后续需确认 |
| 流年 | 当前公历年换算年支，流年命宫落该地支 | 当前年 | `dynamic-chart/dynamic-flow-palaces.ts` | 已对齐旧模块 | 若以后接农历流年，需要增加输入 |
| 流月 | 从流年宫按当前农历月顺行 | 流年宫、农历月 | `dynamic-chart/dynamic-flow-palaces.ts` | 已对齐旧模块 | 闰月处理待扩展 |
| 流日 | 从流月宫按当前农历日顺行 | 流月宫、农历日 | `dynamic-chart/dynamic-flow-palaces.ts` | 已对齐旧模块 | 大月/小月边界待扩展 |
| 流时 | 从流日宫按当前时支顺行 | 流日宫、时支 | `dynamic-chart/dynamic-flow-palaces.ts` | 已对齐旧模块 | 子时跨日口径待扩展 |

## 待校准清单

1. 火星、铃星起点表与顺逆。
2. 地空、地劫起点与顺逆。
3. 长生十二神五行局起点表。
4. 博士十二神顺逆是否完全采用阳男阴女顺行、阴男阳女逆行。
5. 月解、天月、阴煞月表。
6. 天巫当前在 `misc` 和 `monthly` 两处出现，需确认页面是否保留双来源显示。
7. 三台、八座、恩光、天贵的农历日偏移口径。
8. 动态层起运年龄采用五行局数，后续需确认虚岁/实岁以及起运月份细分。

## 维护规则

1. 新增任何 `placementRuleId`，必须同步更新本表。
2. 修改安星表或起点表，必须新增或更新 golden sample。
3. 若同名星曜来自不同来源，`starId` 必须保留不同命名空间，页面显示再做归并。
4. 页面不直接解释规则，只展示 `placementRuleId` 和 ViewModel 已整理好的文本。
5. 校准完成后，把「待校准」改为具体资料版本或样例编号。
