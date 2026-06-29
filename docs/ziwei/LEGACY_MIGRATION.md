# 紫微旧模块迁移与整体整改计划

版本：v0.1  
状态：迁移规划  
更新日期：2026-06-27

## 核心要求

现有紫微斗数内容必须整体按新架构整改。

后续不能出现两套系统：

```txt
旧 ziwei-engine / calculator / knowledge / dynamic 继续扩写
新 contracts / natal-foundation / star-placement / full-chart 又写一套
```

正确方向：

```txt
旧模块能力逐步迁入新目录
旧入口保留兼容 wrapper
新增功能只写在新架构目录
页面和 API 只调用 public-api
```

## 现有文件迁移映射

| 现有文件/目录 | 当前内容 | 新位置 | 整改方式 |
|---|---|---|---|
| `ziwei-core-schema.ts` | 旧 `StarId`、宫位、输入、`BirthPattern`、`PersonalityProfile` | `contracts/*` + `adapters/*` | 基础类型迁入 `contracts`；旧人格结构暂留，后续改成 re-export 或 adapter |
| `lunar.ts` | 阳历转农历、时辰、干支相关 | `birth/lunar-adapter.ts`、`birth/time-branch-resolver.ts`、`birth/ganzhi-resolver.ts` | 按职责拆分，旧文件保留 wrapper |
| `ziwei-engine.ts` | 命身宫、十二宫、宫干、五行局、14 主星、借宫 | `natal-foundation/*` + `star-placement/main-stars/*` | 宫位地基和主星安放拆开 |
| `calculator.ts` | 旧业务盘 `BirthPattern` 组装 | `adapters/legacy-birth-pattern-adapter.ts` | 不再作为完整盘主入口，只做旧人格层适配 |
| `ziwei-gateway.ts` | 旧统一入口 | `public-api/index.ts` | 新入口走 `public-api`；旧 gateway 改为兼容导出 |
| `mapper.ts` | 旧人格映射 | `adapters/personality-profile-adapter.ts` 保持调用 | 不放入完整盘算法；只读兼容后的 `BirthPattern` |
| `public-view.ts` | 公开人格视图 | `adapters/public-view-adapter.ts` | 仍服务人格展示，不参与完整盘页面 |
| `evolution.ts` | 旧演化/人格相关能力 | 后续评估归属 | 暂不扩写，等完整盘主链稳定后再迁 |
| `knowledge/stars.ts` | 空宫与 14 主星定义 | `star-catalog/main-star-catalog.ts` | 星曜资料迁入 catalog |
| `knowledge/starProfiles.ts` | 单星人格资料 | 继续人格知识层，或后续独立 `personality-star-profiles` | 不混进完整盘星曜 catalog |
| `knowledge/pairRelations.ts` | 双星组合关系 | 人格层继续使用 | 完整盘只展示组合时通过 ViewModel 读取，不作为安星规则 |
| `knowledge/pairProfiles/*` | 双星人格资料 | 人格层继续使用 | 不进入 `star-placement` |
| `knowledge/elementGates.ts` | 五行局起运等资料 | `natal-foundation/element-gate.ts` + `dynamic-chart/*` | 五行局本体与动态起运规则拆开 |
| `dynamic/*` | 大运、流年、流月、流日、流时 | `dynamic-chart/*` | 按动态流拆分，接入统一 contracts |
| `dynamic/current-profile/*` | 当前流动人格 | 人格/生命趋向层 adapter | 不作为完整盘核心结构 |

## 新增功能落点规则

任何新紫微排盘能力都必须先判断落点：

| 新功能 | 放置目录 |
|---|---|
| 新输入字段 | `contracts/birth-contract.ts` |
| 新农历/时辰处理 | `birth/` |
| 新宫位基础算法 | `natal-foundation/` |
| 新星曜 ID/名称/分类 | `star-catalog/` |
| 新星曜安放规则 | `star-placement/<对应分组>/` |
| 新完整盘输出字段 | `contracts/full-chart-contract.ts` + `full-chart/` |
| 新动态盘字段 | `contracts/dynamic-chart-contract.ts` + `dynamic-chart/` |
| 新页面展示字段 | `contracts/page-view-contract.ts` + `app/ziwei/_lib/ziwei-page-view-model.ts` |
| 旧人格兼容 | `adapters/` |

禁止直接扩写：

1. 禁止继续往 `ziwei-engine.ts` 塞辅曜、杂曜、四化。
2. 禁止继续往 `ziwei-core-schema.ts` 增加完整盘新参数。
3. 禁止页面直接 import `ziwei-engine.ts` 或 `star-placement/*`。
4. 禁止 API route 内部重复定义请求/响应参数。

## 迁移阶段

### 阶段 A：冻结旧文件职责

旧文件先不删除，但停止新增完整盘能力。

允许：

1. 保留旧人格链路。
2. 添加兼容 wrapper。
3. 添加 deprecated 注释。

不允许：

1. 新增辅曜/杂曜到旧 `StarId`。
2. 新增完整盘页面字段到旧 `BirthPattern`。
3. 在旧 `dynamic` 里直接加页面展示结构。

### 阶段 B：抽出 contracts

先把新完整盘需要的跨模块参数放入 `contracts`。

旧 `ziwei-core-schema.ts` 暂时保留：

1. 人格层继续用旧结构。
2. 新完整盘不再从旧 schema 取新类型。
3. adapter 做新旧转换。

### 阶段 C：迁移基础算法

从 `ziwei-engine.ts` 抽出：

1. `shared/branch-order.ts`
2. `shared/branch-utils.ts`
3. `natal-foundation/life-body-palace.ts`
4. `natal-foundation/palace-sequence.ts`
5. `natal-foundation/palace-stems.ts`
6. `natal-foundation/element-gate.ts`
7. `natal-foundation/borrowed-palace.ts`

旧 `ziwei-engine.ts` 变成兼容入口，内部调用新模块。

### 阶段 D：迁移 14 主星

从 `ziwei-engine.ts` 抽出：

1. `star-placement/main-stars/ziwei-star.ts`
2. `star-placement/main-stars/tianfu-star.ts`
3. `star-placement/main-stars/ziwei-system.ts`
4. `star-placement/main-stars/tianfu-system.ts`
5. `star-placement/main-stars/main-star-placement.ts`

旧引擎结果必须和新主星落点一致。

### 阶段 E：迁移动态层

从 `dynamic/*` 迁到 `dynamic-chart/*`：

1. 大限顺逆。
2. 起运岁数。
3. 流年落宫。
4. 流月、流日、流时落宫。
5. 动态盘 ViewModel 所需字段。

旧动态 gateway 后续只调用 `dynamic-chart`。

### 阶段 F：迁移知识层

拆清两类知识：

1. 排盘星曜 catalog：放 `star-catalog`。
2. 人格解释知识：继续人格层或 adapter，不混入完整盘 catalog。

这样可以避免“同一颗星既是排盘星曜定义，又是人格打分规则”互相污染。

### 阶段 G：新页面只走新入口

`/ziwei` 页面调用：

```txt
app/api/ziwei/full-chart
-> public-api/build-full-ziwei-chart
-> contracts + birth + natal-foundation + star-placement + full-chart + dynamic-chart
```

不能调用：

```txt
ziwei-engine.ts
calculator.ts
mapper.ts
dynamic/dynamic-gateway.ts
```

## 兼容策略

旧人格链路短期继续保留：

```txt
buildPersonalityProfile
-> legacy-birth-pattern-adapter
-> 新 foundation / main-stars
-> 旧 BirthPattern
-> mapper
```

这样做的目的：

1. 完整排盘可以重构。
2. 原有人格、管家、意识模块不被一次性打断。
3. 等完整盘稳定后，再决定人格层是否改读新结构。

## 验收标准

1. 新增完整盘功能不再修改旧 `ziwei-core-schema.ts`。
2. 新增星曜不再进入旧 `knowledge/stars.ts`。
3. 旧 `ziwei-engine.ts` 不再直接承载辅曜、煞曜、杂曜、四化。
4. 新 `/ziwei` 页面只调用 `public-api`。
5. 旧人格输出在迁移前后保持一致。
6. 旧动态功能迁移后，现有动态样例输出保持一致。
7. 检查脚本能发现 contracts 之外的重复参数定义。
