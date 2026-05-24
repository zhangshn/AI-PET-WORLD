> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

# AI-PET-WORLD V2.0 MVP 完整执行计划书

生成日期：2026-05-23  
执行周期：24 天，含 21 天开发冲刺 + 3 天验收缓冲  
执行方式：用户出方案，Codex 按本计划书分模块写代码、验证、汇报  
当前仓库：`F:\ai-pet-world`  

## 0. 本计划书的地位

本计划书用于替代临时口头计划和单纯 Excel 排期，作为后续 AI-PET-WORLD V2.0 MVP 开发执行的主计划。

后续每一轮开发必须以本计划书为执行依据，并同时遵守四份 V2.0 产品文档：

- `AI-PET-WORLD_V2.0_统一主文档_规则生态世界与自主建设文明模拟_完整版.docx`
- `AI-PET-WORLD_MVP完整计划书_v2.0_完整版.docx`
- `AI-PET-WORLD_MVP整体架构设计文档_v2.0_完整版.docx`
- `AI-PET-WORLD_规则生态世界与人格驱动引擎设计文档_v2.0_完整版.docx`

如果后续开发中出现分歧，优先级如下：

1. 用户当轮明确指令
2. 本计划书
3. 四份 V2.0 文档
4. 仓库既有架构和代码习惯

## 1. MVP 总目标

AI-PET-WORLD V2.0 MVP 的目标不是做完整商业产品，而是完成一个可演示、可验证、可继续扩展的核心闭环：

```txt
用户输入生命信息
-> 生成管家人格与世界 seed
-> 生成非固定、可复现、人格/资源/地貌驱动的初始家园
-> 世界事实进入 HomeMapState
-> 世界通过 Tick 推进
-> 管家根据人格、资源、地貌、维护压力自主形成建设意图
-> ConstructionPlan 生成候选计划
-> Executor 生成 MapDiff
-> SafeApply 审计并应用变化
-> FormalVisualModel 派生只读视觉
-> /world 展示家园、日志、管家解释、P-Phone 信息
-> TownAdoptionPrecheck 保持后置，不默认生成宠物
```

MVP 成功标准：

- 用户能完成“创建世界 -> 进入 /world -> 手动 Tick -> 看到自主建设变化 -> 读懂变化原因”。
- 不同生命信息、人格、资源和地貌能产生可观察差异，而不是只换颜色或文案。
- 所有世界变化可追溯到 `HomeMapState / MapDiff / SafeApply / EventLog`。
- 正式 UI 只读渲染 `FormalVisualModel`，不生成世界事实。
- 初始世界不默认出现宠物、宠物床、pet actor、pet_arrival。
- `npm run lint`、`npx tsc --noEmit`、`npm run build` 全通过。

## 2. 产品红线

以下红线任何阶段都不能破坏。

### 2.1 世界事实先于画面

任何正式世界对象必须先进入结构化状态容器，再被渲染：

```txt
State / Rule / Intent
-> HomeMapState / ResourceState / ConstructionPlan
-> MapDiff
-> SafeApply
-> RenderableWorldSnapshot
-> FormalVisualModel
-> FormalWorldView
```

禁止：

- 在 UI、CSS、PNG、SVG 中直接决定房子、宠物、资源、道路等对象是否存在。
- 为了视觉好看绕过 `HomeMapState`。
- 为了演示直接硬编码世界变化。

### 2.2 玩家不是直接建造者

正式产品里玩家是世界源头、观察者、陪伴者，不是建造者。

允许：

- Debug 页面或开发按钮触发 `Tick`。
- 用户创建世界、观察世界、阅读解释、进行有限反馈。

禁止：

- 正式玩法中出现“建造房子”“放置道路”“摆放宠物床”一类玩家直接建造行为。
- 把管家变成执行玩家建造命令的 NPC。

### 2.3 宠物和领养候选必须后置

宠物/领养候选不是开局默认资产，而是 TownAdoptionPrecheck 与 ButlerAdoptionIntent 后置链路的可能结果。

禁止：

- 初始世界默认生成 `pet actor`。
- 初始世界默认生成 `pet bed`。
- 初始世界默认生成 `pet_arrival`、`pet_rest` 等事实。
- 把“照护区”写成宠物已经存在的暗示。
- 宠物说人话。

允许：

- TownAdoptionPrecheck 生成 `no_event`、`observe_world_ready`、`adoption_candidate_later`、`eligible_later` 等候选状态。
- P-Phone 或管家解释“未来可能出现新的生命关系”，但不能承诺必然出现。

### 2.4 资源不能凭空增加

资源是世界状态，不是无限货币。

资源新增必须来自：

- 初始化
- 自然恢复
- 天气/地貌
- 维护行为
- 资源转换
- 交易或事件

禁止：

- 资源不足时仍然直接建成建筑。
- 每个 tick 无来源地固定 +1。
- 把地貌只当背景色或背景图。

### 2.5 人格必须影响行为

人格不是展示标签，必须影响：

- 布局
- 资源偏好
- 建设顺序
- 房屋偏好
- 维护优先级
- TownAdoptionPrecheck 倾向
- 视觉风格投影

失败表现：

- 不同用户世界只改颜色。
- 管家解释不同，但 MapDiff 和布局一样。
- 房屋风格只靠 CSS 硬编码。

### 2.6 正式 UI 不展示原始命理术语

内部可以保留紫微、八字等人格算法；正式 UI 应表达为：

- 生命信息人格引擎
- 管家人格
- 建设倾向
- 生活节律
- 关系倾向
- 世界风格

Debug 页面可以展示内部标签，但必须与正式 `/world` 分离。

## 3. 当前代码现状判断

本仓库不是从零开始。当前已经有大量 V1/V1.5/V2 雏形模块。

### 3.1 已有基础

- Next.js 16.2.4 + React 19.2.4 项目结构存在。
- `npm run lint` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。
- 已有 `/create-world`、`/world`、`/world-debug`、`/personality-test` 等页面。
- 已有 `HomeMapState`、`MapDiff`、`SafeApply`、`ConstructionPlanner`、`WorldLoop`、`FormalVisualModel`、`TownAdoptionPrecheck` 等核心模块。

### 3.2 需要收口的问题

- 文档版本口径混乱，旧 MVP/V1 文档仍可能影响开发判断。
- 初始世界生成仍有 Scene Recipe 固定区域痕迹，需要继续解耦。
- 资源字段已有，但 ResourceCycle、ResourceTransaction、BiomeRule 的守恒链路还不够完整。
- Construction 已有很多模块，但资源成本、地貌限制、维护压力和 runtime tick 的产品闭环还要收紧。
- HousePreference / HouseArchetype 没有形成独立清晰的工程入口。
- FormalWorldView 已有，但 `/world` 仍偏工程演示，需要产品化。
- TownAdoptionPrecheck 已有候选链路，但宠物后置红线需要强验收。
- Smoke audit 需要形成稳定命令或明确执行入口。

## 4. 总周期

建议执行周期为 24 天：

- 第 1-21 天：MVP 开发冲刺
- 第 22-24 天：验收缓冲、视觉修正、录屏脚本、缺陷修补

若需要压缩，可按 21 天执行，但风险较高。正式计划采用 24 天。

| 阶段 | 天数 | 模块 | 目标 |
| --- | ---: | --- | --- |
| D1-D2 | 2 | MVP-CLOSURE-00 | 文档口径与红线落仓库 |
| D3-D5 | 3 | WORLD-GEN-04 | 非固定世界生成重构 |
| D6-D8 | 3 | ECOLOGY-00 | 地貌与资源循环底座 |
| D9-D11 | 3 | CONSTRUCTION-05 | 自主建设接入 Runtime Tick |
| D12-D13 | 2 | HOUSE-STYLE-00 | 人格驱动房屋偏好 |
| D14-D17 | 4 | VISUAL-DELIVERY-02 | 主世界视觉产品化 |
| D18-D20 | 3 | LIFE-EVENT-01 | 小镇领养观察增强 |
| D21 | 1 | MVP-DEMO-00 | Demo 闭环打通 |
| D22-D24 | 3 | MVP-ACCEPTANCE-00 | 验收缓冲与修补 |

## 5. 模块计划

### 5.1 MVP-CLOSURE-00：文档审核与 V2.0 统一

优先级：P0  
周期：D1-D2  
是否写业务代码：否  

目标：

- 将四份 V2.0 文档和本计划书确认为后续最高执行依据。
- 将旧文档标记为历史资料，避免继续误导开发。
- 建立开发红线、Forbidden Tokens、模块执行模板。

允许修改：

- `README.md`
- `src/docs/**/*.md`
- `src/world/engine-notes/**/*.md`
- 必要时新增 `src/docs/v2/*`

禁止修改：

- `src/**/*.ts`
- `src/**/*.tsx`
- `src/**/*.css`
- `package.json`
- `public/*`

关键交付：

- V2.0 文档索引
- 旧文档历史声明
- 开发红线文档
- Forbidden token audit 说明
- 每轮执行模板

验收标准：

- README 指向 V2.0 执行依据。
- 旧 V1/V1.2/MVP 文档不再声明自己是最高依据。
- 后续开发能明确知道哪些可以改、哪些不能改。

### 5.2 WORLD-GEN-04：非固定世界生成重构

优先级：P0  
周期：D3-D5  
是否写业务代码：是  

目标：

- 把初始家园从固定模板升级为 `seed + personality + resources + biome + phase + constraints` 驱动。
- Scene Recipe 只能提供候选关系和约束，不能决定最终固定布局。
- 生成结果必须稳定、可复现、可审计。

允许修改：

- `src/world/generation/*`
- `src/world/placement/*`
- `src/world/map-state/*`
- `src/world/mvp-core/*`
- 与 smoke audit 直接相关的测试/调试入口

禁止修改：

- `src/app/world/*`，除非只是接入已有只读数据
- `public/*`
- `package.json`，除非为了增加明确 smoke script 并经过确认

关键交付：

- `WorldLayoutGenerationInput` 增强
- `LayoutCandidate` / `PlacementProposal` 清晰化
- layout fingerprint
- variation audit
- same seed stability 场景
- different personality layout 场景

验收标准：

- 同一输入、同一 seed、同一状态重复生成 fingerprint 一致。
- 不同人格/资源/地貌至少在两个维度产生差异：区域中心、路径、住所位置、边界密度、资源区组织。
- 初始世界无默认宠物事实。
- 禁止使用 `Math.random` 或 `Date.now` 参与世界生成。

### 5.3 ECOLOGY-00：地貌与资源循环底座

优先级：P0  
周期：D6-D8  
是否写业务代码：是  

目标：

- 建立可执行的地貌和资源规则。
- 让资源成为世界状态，而不是文案或 UI 数值。
- 建设、维护、恢复都必须能影响资源。

允许修改：

- `src/world/ecology/*`
- `src/world/environment/*`
- `src/world/map-state/*`
- `src/world/mvp-core/*`
- 必要时新增 `src/world/ecology/resource-cycle-*`

禁止修改：

- 不为资源系统改 UI 造假。
- 不新增与 MVP 无关的完整经济系统。

关键交付：

- `BiomeRule`
- `ResourcePoolState`
- `ResourceTransaction`
- `ResourceCycleTick`
- `ResourceAudit`
- biome resource caps
- regen / consumption / pressure 计算

验收标准：

- 草地、森林、沙漠、绿洲至少有可区分资源规则。
- 资源有上限、当前值、恢复率、压力、交易/变更记录。
- 建设计划能读取资源状态。
- 资源不足时能阻止或延期建设。
- 资源新增有来源说明。

### 5.4 CONSTRUCTION-05：自主建设接入 Runtime Tick

优先级：P0  
周期：D9-D11  
是否写业务代码：是  

目标：

- 管家在 tick 中根据人格、资源、地貌、维护压力自主生成建设意图。
- 建设意图转成候选计划，候选计划转成 MapDiff，经 SafeApply 后改变世界。
- 玩家不能直接建造，Debug tick 只是推进世界运行。

允许修改：

- `src/world/construction/*`
- `src/world/world-loop/*`
- `src/world/map-state/*`
- `src/world/mvp-core/*`
- `src/world/runtime-context/*`

禁止修改：

- 不在正式 UI 中增加玩家建造按钮。
- 不绕过 SafeApply。
- 不让候选计划直接成为世界事实。

关键交付：

- `ConstructionPlannerInput` 增强
- `ConstructionPlanCandidates` 增强
- `ConstructionExecutionResult` 增强
- `ConstructionSafeApplyResult` 增强
- resource-limited construction 场景
- manual debug tick 场景

验收标准：

- 手动/Debug Tick 后能产生建设计划、MapDiff、日志和可见状态变化。
- 资源不足时返回 wait / prepare / delayed，而不是硬建成。
- accepted/rejected diff 可追踪。
- P-Phone 或日志能解释建设原因。

### 5.5 HOUSE-STYLE-00：人格驱动房屋偏好

优先级：P1  
周期：D12-D13  
是否写业务代码：是  

目标：

- 将“管家会建自己喜欢的房子”工程化为可计算模型。
- 不同人格影响房屋类型、空间组织、材料偏好、扩建节奏、维护优先级。

允许修改：

- `src/world/construction/*`
- `src/world/formal-visual-model/*`
- `src/world/rendering/*`
- 必要时新增 `src/world/construction/house-style-*`

禁止修改：

- 不在 UI 中硬编码房子。
- 不让 CSS 决定房屋事实。

关键交付：

- `HousePreference`
- `HouseArchetype`
- `buildHousePreferenceFromButlerProfile`
- house candidate scoring
- house style visual projection

建议房屋原型：

- `ordered_compact_cabin`
- `warm_care_cottage`
- `protective_courtyard`
- `quiet_retreat_house`
- `aesthetic_garden_home`
- `adaptive_modular_home`

验收标准：

- 不同管家人格生成不同 house preference。
- HousePreference 影响 ConstructionPlan 排序。
- FormalVisualModel 能表现房屋倾向，但不生成事实。

### 5.6 VISUAL-DELIVERY-02：主世界视觉产品化

优先级：P1  
周期：D14-D17  
是否写业务代码：是  

目标：

- 让 `/world` 从工程调试图升级为可演示的低保真家园。
- 视觉必须来自世界事实，不反向创造事实。
- 用户能看懂住所、路径、资源区、环境、管家解释、P-Phone。

允许修改：

- `src/world/rendering/*`
- `src/world/formal-visual-model/*`
- `src/app/world/components/*`
- `src/app/world/world-route-page.tsx`
- `src/app/world/world-route-page.styles.module.css`
- `src/app/world/mvp-world-view-model.ts`

禁止修改：

- 不在 UI 生成 placement/actor/world facts。
- 正式 `/world` 不显示 raw debug tags。
- 不用纯装饰假图掩盖世界状态。

关键交付：

- FormalWorldView 产品化
- HUD 摘要
- 管家解释面板
- P-Phone 信息区
- 世界日志展示
- before/after tick 可见变化

验收标准：

- 打开 `/world` 一眼能看出这是家园，不是坐标测试图。
- 视觉变化能追溯到 `FormalVisualModel`。
- 不同人格/地貌/资源差异可见。
- 页面移动端和桌面端不出现明显遮挡、溢出、重叠。

### 5.7 LIFE-EVENT-01：小镇领养观察增强

优先级：P1  
周期：D18-D20  
是否写业务代码：是  

目标：

- 完善 TownAdoptionPrecheck 和 ButlerAdoptionIntent，使领养候选成为后置可能性，而不是默认路线。
- 资源、空间、关系倾向、世界稳定度都会影响是否等待、准备或接纳。

允许修改：

- `src/world/town-adoption/*`
- `src/world/mvp-core/*`
- P-Phone / ViewModel 相关只读展示

禁止修改：

- 不默认生成宠物。
- 不默认生成宠物床。
- 不让宠物说人话。
- 不把照护区暗示成宠物事实。

关键交付：

- `TownAdoptionCandidate` 增强
- `ButlerAdoptionIntentCandidate` 增强
- readiness / blockers / reasons
- no default pet audit
- P-Phone 解释

验收标准：

- 初始世界无 pet actor、pet bed、pet_arrival。
- 资源不足、空间不足、关系倾向不匹配时返回等待或准备。
- 只有明确 `adoption_safe_apply` 才能进入宠物/领养候选事实链路。

### 5.8 MVP-DEMO-00：MVP 可演示闭环

优先级：P0  
周期：D21  
是否写业务代码：少量整合代码  

目标：

- 打通完整演示流。
- 修复影响演示的链路断点。
- 输出录屏脚本和验收报告。

允许修改：

- `src/world/mvp-core/*`
- `src/app/create-world/*`
- `src/app/world/*`
- `src/docs/*`

禁止修改：

- 不为了演示伪造世界事实。
- 不跳过前序模块红线。

关键交付：

- MVP smoke audit
- demo flow
- demo script
- acceptance report

验收标准：

```txt
创建世界
-> 进入 /world
-> 看到初始家园
-> 触发 Tick
-> 管家自主生成建设计划
-> MapDiff/SafeApply 改变世界
-> FormalWorldView 显示变化
-> P-Phone / 日志解释原因
-> TownAdoptionPrecheck 仍保持后置
```

### 5.9 MVP-ACCEPTANCE-00：验收缓冲与修补

优先级：P0  
周期：D22-D24  
是否写业务代码：只修复验收问题  

目标：

- 处理 build、类型、视觉、红线、文案、演示稳定性问题。
- 固化后续 Closed Alpha 任务。

允许修改：

- 验收失败相关文件
- 文档和验收报告

禁止修改：

- 不新增大功能。
- 不引入新产品方向。
- 不破坏已通过模块。

关键交付：

- final acceptance report
- closed alpha gap list
- demo-ready checklist

验收标准：

- `npm run lint` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。
- smoke 场景通过。
- 页面可演示。

## 6. 每轮执行协议

后续每轮开发必须先声明以下内容。

```txt
当前阶段：
本轮目标：
本轮不做：
允许修改文件：
禁止修改文件：
是否生成世界事实：
世界事实链路：
是否影响宠物：
验证方式：
```

Codex 每轮完成后必须汇报：

```txt
已完成：
未完成：
改了哪些文件：
没有改哪些文件：
如何验证：
验证结果：
下一步建议：
```

## 7. 验证命令

每个写代码模块默认必须执行：

```bash
npm run lint
npx tsc --noEmit
npm run build
```

如果模块涉及世界闭环，还必须增加至少一种功能验证：

- same seed stability
- different personality layout
- resource limited construction
- no default pet
- visual readonly check
- manual debug tick

后续建议增加：

```bash
npm run smoke:mvp
```

该脚本可以在后续模块中补入，前提是范围明确。

## 8. Smoke 场景定义

### 8.1 same_seed_stability

输入相同生命信息、seed、资源、地貌和时间，重复生成两次。

通过标准：

- `HomeMapState` fingerprint 一致。
- placement 数量一致。
- zone bounds 一致。
- 无随机漂移。

### 8.2 different_personality_layout

输入不同生命信息或人格向量。

通过标准：

- layout fingerprint 不同。
- 至少两个结构维度不同。
- 不能只是颜色或文案不同。

### 8.3 biome_rule_difference

使用草地、森林、沙漠、绿洲等不同地貌。

通过标准：

- resource caps 不同。
- regen rates 不同。
- construction modifiers 不同。
- visual tokens 可投影差异。

### 8.4 resource_limited_construction

构造资源不足场景。

通过标准：

- 建设计划被延期、降级或转为准备资源。
- SafeApply 拒绝不可行 diff。
- 日志解释资源不足原因。

### 8.5 automatic_butler_construction

触发手动/Debug Tick。

通过标准：

- 管家生成自主建设意图。
- 生成 ConstructionPlan candidate。
- 生成 MapDiff candidate。
- 经 SafeApply 后世界状态变化或明确拒绝。

### 8.6 no_default_pet

检查初始世界和 tick 后未 accept companion 的状态。

通过标准：

- 无 pet actor。
- 无 pet bed。
- 无 pet_arrival。
- 无 pet_rest。
- 无宠物事实投影。

### 8.7 visual_readonly_check

检查正式 UI。

通过标准：

- `FormalWorldView` 只读取 `FormalVisualModel`。
- UI 不 import generation/placement 决策模块来生成事实。
- CSS 不决定世界对象存在。

## 9. 文件边界原则

### 9.1 世界事实层

包括：

- `src/world/map-state/*`
- `src/world/generation/*`
- `src/world/ecology/*`
- `src/world/construction/*`
- `src/world/world-loop/*`
- `src/world/town-adoption/*`

职责：

- 生成、推进、审计世界事实。
- 不能依赖 React UI。

### 9.2 视觉投影层

包括：

- `src/world/rendering/*`
- `src/world/formal-visual-model/*`

职责：

- 从世界事实派生可读视觉模型。
- 不能新增世界事实。

### 9.3 前端只读层

包括：

- `src/app/world/*`
- `src/app/create-world/*`

职责：

- 收集输入。
- 展示世界。
- 触发 debug/manual tick。
- 不直接生成 placement、actor、world object。

### 9.4 Debug 层

包括：

- `src/app/world-debug/*`
- debug runner / audit runner

职责：

- 显示内部标签、审计、fingerprint、raw data。
- 不能被误认为正式产品 UI。

## 10. Forbidden Tokens

以下 token 在正式初始世界中禁止出现，除非上下文是审计、文档、测试或明确后置事件：

- `pet_arrival`
- `pet_rest`
- `pet_actor`
- `pet-bed`
- `pet bed`
- `incubator`
- `embryo`
- `hatching`
- `incubating`

以下 token 在正式 UI 中需要谨慎：

- raw tags
- source diagnostics
- 命理原始术语
- 紫微术语裸露
- 八字术语裸露

以下实现方式禁止用于世界生成：

- `Math.random`
- `Date.now` 直接参与世界 seed 决策
- UI 生成 placement
- CSS 决定对象事实
- PNG 决定对象事实

## 11. 进入下一阶段的规则

每个模块必须满足以下条件，才能进入下一模块：

- 目标代码完成。
- 红线未破坏。
- 验收场景通过或明确记录未通过原因。
- `lint / tsc / build` 通过，除非本轮明确是纯文档。
- 最终回复列出修改文件和验证结果。

如果模块未通过，不进入下一模块，只做修复轮。

## 12. 本计划的第一轮执行建议

第一轮应执行：

```txt
当前阶段：MVP-CLOSURE-00
目标：把 V2.0 文档依据、旧文档历史状态、开发红线和本计划书落仓库
不做：不改业务代码，不改 TS/TSX/CSS/package/public
验证：文档检查 + git diff
```

完成后进入：

```txt
WORLD-GEN-04
```

第二轮才开始写业务代码。

## 13. 最终判断

AI-PET-WORLD V2.0 MVP 的开发核心不是“多做功能”，而是保证每个功能都落在同一条产品哲学上：

```txt
生命信息驱动人格
人格影响行为
行为受资源和地貌约束
建设由管家自主发起
变化经 MapDiff / SafeApply 审计
视觉只读呈现事实
宠物和小镇领养观察
世界能长期演化
```

后续所有代码开发、文档修订、视觉优化和演示验收，都按本计划书执行。
