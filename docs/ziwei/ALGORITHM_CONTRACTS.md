# 紫微斗数算法与参数契约

更新时间：2026-08-03 09:23:45 +08:00

状态：active-algorithm-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。


## 参数定义原则

1. 出生参数只在契约和算法入口定义一次。
2. 地支、天干、宫位、星曜 ID、盘层类型只从 contracts 或核心目录导出。
3. 页面、URL、分享、调试面板不得重复定义参数。
4. 客户端组件只能从 core contracts 做 type-only import；运行时数据走 ViewModel。

## 硬规则来源

| 来源 | 作用 |
|---|---|
| `project.star-catalog` | 星曜 ID、分类、显示名、别名 |
| `project.pattern-catalog` | 格局 ID、分类、命中条件、隐藏边界 |
| `project.transformation-rules` | 十干四化目标、本命四化、动态四化 |
| `project.brightness-table` | 星曜庙旺落陷、承接强弱 |
| `project.dynamic-flow-rules` | 大限、流年、流月、流日、流时和盘层继承 |

只有这些 P0 项目算法来源可以作为硬规则。

## 漂移检查

`scripts/ziwei/check-hard-rule-source-drift.mjs` 必须通过，检查内容包括：

1. 五个 P0 来源必须保持 `project-algorithm`、`high`、`original-content`。
2. 五个 P0 来源在复核队列中必须保持 `canActAsHardRule=true`。
3. 星曜、格局、四化、庙旺落陷、动态盘规则必须能回到唯一代码来源。
4. 文档和资料扩充队列必须引用这些来源，不得另起一套硬规则。

`scripts/ziwei/check-p24-p34-closure.mjs` 必须通过，检查内容包括：

1. P24-P34 每个阶段必须有闭合记录。
2. 每个闭合记录必须有完成范围、验收证据、来源边界、后续边界和验证命令。
3. 闭合记录引用的资料扩充队列项必须真实存在。
4. `docs/ziwei` 的文件集合必须与闭合检查器登记的正式文档一致，不得建立平行计划或历史文档。

`scripts/ziwei/run-current-ziwei-closure-checks.mjs` 是历史闭合入口的兼容转发，只调用当前有效的三类检查：

1. `check-hard-rule-source-drift.mjs`
2. `check-content-knowledge-repository.mjs`
3. `check-p24-p34-closure.mjs`

`scripts/ziwei/check-p35-data-intake.mjs` 负责 P35 资料采集结构检查，检查内容包括：

1. P35-A 到 P35-F 阶段计划必须存在。
2. 全网资料必须先登记来源和存储策略。
3. 原始片段不能直接存现代书籍内容、课程正文、网站整篇正文。
4. 主题映射必须能回到 `sourceId`。
5. 可用性评分必须包含存储阻断规则。

## 固定算法边界

1. 紫微斗数排盘、安星、四化、庙旺落陷、动态盘转法必须按照正式规则实现。
2. 阴男、阳男、阴女、阳女顺逆行规则必须在动态盘算法层处理。
3. 大限、流年、流月、流日、流时的命宫和十二宫标记必须按当前查看盘层展示。
4. 本命线条、流年线条、流月线条等不能混在一起；当前查看哪一层，只展示哪一层的关系线。
5. 四化自身不分庙旺，庙旺落陷看目标星和目标宫。

## 安星规则标识登记

以下 `placementRuleId` 必须与 `src/ai/destiny-core/ziwei-core/star-placement/` 中的实现一一对应；本表登记身份，不在文档重复实现算法：

- `main.ziwei-system`
- `main.tianfu-system`
- `assistant.chang-qu.time-branch`
- `assistant.kui-yue.year-stem`
- `assistant.left-right.lunar-month`
- `assistant.lucun.year-stem`
- `assistant.tianma.year-branch`
- `malefic.qingyang-tuoluo.lucun-neighbors`
- `malefic.huoxing-lingxing.year-branch-time`
- `malefic.dikong-dijie.time-branch`
- `transformation.natal.year-stem`
- `lifecycle.changsheng.element-gate-direction`
- `yearly.boshi.lucun-direction`
- `yearly.jiangqian.trine-start-forward`
- `yearly.suiqian.year-branch-forward`
- `monthly.tianwu.lunar-month`
- `monthly.tianyue.lunar-month`
- `monthly.yinsha.lunar-month`
- `monthly.yuejie.lunar-month`
- `daily-hourly.bazuo.youbi-lunar-day-backward`
- `daily-hourly.enguang.wenchang-lunar-day-minus-one`
- `daily-hourly.santai.zuofu-lunar-day-forward`
- `daily-hourly.tiangui.wenqu-lunar-day-minus-one`
- `misc.nobleman.fenggao.time-branch`
- `misc.nobleman.fengge.year-branch`
- `misc.nobleman.longchi.year-branch`
- `misc.nobleman.taifu.time-branch`
- `misc.nobleman.tianwu.lunar-month`
- `misc.punishment.posui.year-branch-group`
- `misc.punishment.tianku-tianxu.year-branch`
- `misc.punishment.tianxing.lunar-month`
- `misc.romance.hongluan.year-branch`
- `misc.romance.tianxi.opposite-hongluan`
- `misc.romance.tianyao.lunar-month`
- `misc.romance.xianchi.year-branch-group`
- `misc.solitary.guchen-guasu.year-branch-group`

## 待校准规则边界

待校准不表示规则可由页面或资料文本临时改写。任何待校准项必须进入结构化复核队列，绑定规则标识、来源、黄金样本、预期差异和 Owner 结论；在新版本通过回归前，正式运行继续使用已登记版本。

## 算法变更门禁

1. 新增或修改硬规则必须核对来源漂移。
2. 新增资料必须同步来源引用、可存储边界和一致性检查。
3. 规则变更必须保留旧版本、回归样本和变更证据，不能覆盖历史结果。
