# AI-PET-WORLD 项目文件审计报告

## 0. 审计结论摘要

- 当前项目不是要大删，而是要收口：核心算法、世界运行、世界生成、地图状态、建设链路、Renderer 都已经形成可继续演进的骨架。
- 核心算法、世界运行、世界生成、Renderer 都保留，且未来客户端也应复用这些核心模块。
- 当前主要需要断开的只是正式 `/world` 中的卡片体验页：`WorldExperiencePage` 与 `experience/*` 可以保留，但不应继续作为正式世界主链路。
- 测试、调试、F3 开发审计、历史验证报告全部保留，不进入删除列表。
- `incubator` / `hatch` / `embryo` 先兼容保留，因为 `worldEngine`、`systems`、save / restore、审计链路仍有真实引用；未来迁移为 pet arrival / adoption / 分配时刻语义后再评估。
- 本轮 `DELETE_SAFE` 为空。第一轮不建议删除任何文件。

## 1. 冻结架构确认

正式主链路冻结为：

```txt
用户生命信息
→ 命理核心算法
→ LifeCoreProfile
→ ButlerVisualProfile / PetVisualProfile / WorldVisualProfile
→ AssetModuleSelection
→ WorldGeneration
→ HomeMapState
→ WorldRuntime
→ WorldExpression
→ ActorRuntime / MapDiff
→ Renderer
```

本轮只记录审计结论，不实现 `LifeCoreProfile`、`VisualProfile`、`ActorRuntime`、`WorldExpression`。

## 2. 分类规则

| 分类 | 用途 | 处理方式 |
| --- | --- | --- |
| `KEEP_CORE` | 核心算法、世界运行、世界生成、地图状态、建设、Renderer、持久化、运行时类型 | 保留，未来客户端也要复用，不删除 |
| `KEEP_TEST` | 测试页、调试页、F3 审计、测试报告、test/debug/audit 产物 | 保留，不进入删除候选 |
| `KEEP_DEV` | 文档、配置、开发辅助脚本、架构说明、素材清单 | 保留，可继续补文档 |
| `DISCONNECT_UI` | 当前不适合作为正式 `/world` 主链路的体验页、卡片页、展示模型 | 文件先保留，后续从正式入口断开，可迁移到 dev / F3 审计 |
| `DEPRECATE_LATER` | 当前仍有引用或兼容用途，但产品语义未来要迁移 | 先保留，迁移完成且确认无引用后再评估 |
| `DELETE_SAFE` | 确认无引用、非测试、非调试、非核心、非文档、非配置，且删除不影响 lint / tsc / build | 本轮为空；删除前必须再次确认 |

## 3. 当前目录总览

| 目录 | 当前用途 | 当前分类 | 是否保留 | 是否未来迁移 | 是否可删除 |
| --- | --- | --- | --- | --- | --- |
| `src/ai/` | AI 网关、命理核心、人格解释、生命趋势、意识 / 记忆 / 行为核心 | `KEEP_CORE` | 是 | 部分输出后续接 `LifeCoreProfile` | 否 |
| `src/ai/destiny-core/` | 当前真实命理核心路径，包含 ziwei-core 与 bazi-core | `KEEP_CORE` | 是 | 文档命名需从旧 `personality-core` 对齐到当前 `destiny-core` | 否 |
| `src/ai/personality-core/` | 命理结果的人格解释、life-profile、butler-profile 映射 | `KEEP_CORE` | 是 | 后续承接 `LifeCoreProfile` 汇总 | 否 |
| `src/ai/life-tendency-core/` | 当前生命趋势与运行时倾向计算 | `KEEP_CORE` | 是 | 后续接入冻结主链路 | 否 |
| `src/engine/` | `worldEngine`、tick、time、runtime runner、状态聚合 | `KEEP_CORE` | 是 | App 适配层应变薄 | 否 |
| `src/systems/` | pet / butler / event / home / incubator 等运行系统 | `KEEP_CORE` | 是 | incubator 语义后续迁移 | 否 |
| `src/world/generation/` | seed、InitialHomeGenerator、初始家园 recipe | `KEEP_CORE` | 是 | 接入 LifeCoreProfile / VisualProfile | 否 |
| `src/world/placement/` | PlacementEngine、layout / placement rules | `KEEP_CORE` | 是 | 接入 AssetModuleSelection | 否 |
| `src/world/map-state/` | HomeMapState、本地快照、MapDiff | `KEEP_CORE` | 是 | 与正式 Renderer 链路收口 | 否 |
| `src/world/construction/` | ConstructionPlan、planner、executor、gateway | `KEEP_CORE` | 是 | 未来由 LifeCoreProfile 驱动风格 | 否 |
| `src/world/rendering/` | HomeMapRenderer、render model、sprite / canvas layers | `KEEP_CORE` | 是 | 作为正式 `/world` 与客户端 Renderer 的 Web 参考实现 | 否 |
| `src/world/visualization/` | WorldExperience / logic visualization model mapper | `DISCONNECT_UI` / `KEEP_TEST` | 是 | 迁移到 F3 / dev 审计展示 | 否 |
| `src/world/runtime/` | 世界运行态、天气、空间、实体、移动、生态、文明 runtime | `KEEP_CORE` | 是 | 后续接 WorldExpression / ActorRuntime | 否 |
| `src/world/progression/` | 世界成长、设施注册、progression runner | `KEEP_CORE` | 是 | 继续承接世界长期成长 | 否 |
| `src/world/offline/` | 离线 catchup 规划与执行 | `KEEP_CORE` | 是 | 客户端化时复用规则 | 否 |
| `src/world/persistence/` | save schema / gateway / validator / storage | `KEEP_CORE` | 是 | incubator 字段迁移需兼容旧存档 | 否 |
| `src/world/adoption/` | adoption center schema / gateway / incubator adapter | `KEEP_CORE` / `DEPRECATE_LATER` | 是 | 未来 pet arrival / adoption 入口承接 | 否 |
| `src/app/world/page.tsx` | 当前临时 Web 世界入口，仍渲染卡片体验页 | `KEEP_CORE` / `KEEP_DEV` | 是 | 目标收口到 `HomeMapRenderer` | 否 |
| `src/app/world/hooks/` | Web 临时适配层，连接 worldEngine、save、offline、F3 状态 | `KEEP_CORE` / `KEEP_DEV` | 是 | 核心逻辑不应继续写死在 app 层 | 否 |
| `src/app/world/components/experience/` | 卡片体验页 | `DISCONNECT_UI` | 是 | 迁移到 dev / F3 审计或后续删除评估 | 否 |
| `src/app/world/components/logic-visualization/` | 逻辑可视化和 F3 / dev 审计展示 | `KEEP_TEST` | 是 | 保持开发审计用途 | 否 |
| `src/app/world/components/pixel-ui/` | 旧像素 UI 原型 / 组件积木 | `KEEP_TEST` / `DEPRECATE_LATER` | 是 | 不作为正式主链路，后续确认迁移 | 否 |
| `src/app/personality-test/` | 命理 / 人格 / 八字 / 紫微测试页 | `KEEP_TEST` | 是 | 继续作为算法验证入口 | 否 |
| `src/app/world-debug/`、`src/app/pixel-layer-test/` | 调试页 / 像素层测试页 | `KEEP_TEST` | 是 | 保留调试用途 | 否 |
| `src/types/` | pet / butler / home / event / incubator 等共享类型 | `KEEP_CORE` | 是 | incubator 类型未来迁移时兼容处理 | 否 |
| `docs/` | MVP 主线文档、素材文档、规则文档 | `KEEP_DEV` | 是 | 继续补架构冻结文档 | 否 |
| `src/docs/` | 历史审计、测试报告、P-Phone 审计、测试产物 | `KEEP_TEST` / `KEEP_DEV` | 是 | 历史资料保留 | 否 |
| `public/assets/` | P0 生成素材资源 | `KEEP_CORE` / `KEEP_DEV` | 是 | actor 占位素材存在 404 TODO | 否 |
| `public/*.svg` | Next 默认 / 静态图标资源 | `KEEP_DEV` | 是 | 无需本轮处理 | 否 |
| `art-assets/` | 素材参考图和 source zip | `KEEP_DEV` | 是 | 继续作为素材生产参考 | 否 |

## 4. 核心保留清单 KEEP_CORE

| 路径 | 当前用途 | 保留原因 | 后续动作 |
| --- | --- | --- | --- |
| `src/ai/` | AI 总入口与多个 AI 子系统 | 冻结主链路从用户生命信息进入命理核心与人格 / 行为映射 | 后续新增 `LifeCoreProfile` 时从这里统一收口 |
| `src/ai/gateway.ts` | 统一导出命理、人格解释、生命趋势、刺激、认知、行为、agent、butler profile | App / systems 已通过 gateway 读 AI 能力 | 保持 gateway 边界，不让 UI 深层读取内部核心 |
| `src/ai/destiny-core/` | 当前真实命理核心路径：`ziwei-core`、`bazi-core` | 紫微 / 八字计算是项目第一护城河 | 禁止删除；文档中旧 `personality-core` 命名需注明差异 |
| `src/ai/personality-core/` | personality interpretation、life-profile、butler-profile | 当前承担命理结果到人格解释 / 管家 profile 的映射 | 后续接入 `LifeCoreProfile`，不重写命理核心 |
| `src/ai/life-tendency-core/` | life runtime 与当前生命趋势计算 | 世界运行可读取生命倾向 | 后续和 WorldRuntime / WorldExpression 对接 |
| `src/engine/` | `worldEngine`、`timeSystem`、world-engine runners | 当前负责 tick、time、pet、butler、event、home、incubator、runtime、progression、save / restore | 保留，未来客户端化复用核心 runner |
| `src/engine/worldEngine.ts` | 世界主调度器、快照、恢复、离线报告、状态输出 | 连接 systems、runtime、progression、adoption adapter，是当前运行核心 | 禁止删除；未来只让 app 层做薄适配 |
| `src/engine/world-engine/` | tick runner、phase runner、runtime runner、state sync、event update、pet / butler runner | worldEngine 的模块化执行链 | 保留，继续收口运行职责 |
| `src/systems/` | pet、butler、event、home、incubator 与系统边界 | 世界运行核心系统集合 | 保留；incubator 语义未来迁移但不直接删 |
| `src/world/generation/` | `InitialHomeGenerator`、world seed、scene recipe、generation schema | 负责初始 HomeMapState 生成 | 后续接入 `LifeCoreProfile` / `VisualProfile` |
| `src/world/placement/` | `PlacementEngine`、placement rules、layout rules | 负责摆放、承托、规则、路径 / 区域关系 | 后续接 AssetModuleSelection |
| `src/world/map-state/` | `HomeMapState`、`MapDiff`、local persistence | 冻结主链路中的地图状态和增量变化层 | 与 Renderer 正式链路收口 |
| `src/world/construction/` | `ConstructionPlan`、planner、executor、gateway | 管家建设意图转地图变化的核心层 | 后续由 LifeCoreProfile 生成建设风格，本轮不改 |
| `src/world/rendering/` | `HomeMapRenderer`、`buildHomeMapRenderModel`、sprite / canvas layer | `HomeMapRenderer` 是未来正式 `/world` 和客户端 Renderer 的 Web 参考实现 | 禁止删除；目标链路应直接渲染它 |
| `src/world/persistence/` | world save gateway / schema / storage / validator | save / restore 必备 | 后续字段迁移必须兼容旧存档 |
| `src/world/offline/` | 离线 catchup | 世界连续性核心能力 | 保留 |
| `src/world/progression/` | world progression system / runner / facility registry | 世界长期成长核心能力 | 保留 |
| `src/world/runtime/` | world runtime、weather、spatial、entity、movement、ecology、civilization runtime | WorldRuntime 与未来 ActorRuntime / WorldExpression 的基础 | 保留 |
| `src/world/adoption/` | adoption center schema / gateway / incubator adapter | adoption 是未来宠物抵达 / 分配入口；当前兼容 incubator | 保留，不删除 |
| `src/types/` | 共享状态类型 | 多系统依赖 | 保留；`incubator.ts` 后续只做迁移兼容 |

### 命理核心路径说明

- 当前真实命理核心路径是 `src/ai/destiny-core/ziwei-core/` 与 `src/ai/destiny-core/bazi-core/`。
- `src/ai/personality-core/` 当前不是旧文档中描述的紫微排盘核心目录，而是人格解释、life-profile、butler-profile 等映射层。
- `docs/mvp/AI_PET_WORLD_MVP_V1_2_FULL_PLAN.md` 仍多处使用 `personality-core` 表达早期命理核心命名；审计结论是：保留文档语义，但后续架构冻结文档应明确当前代码命名为 `destiny-core`。

### 世界生成与地图状态职责

- `InitialHomeGenerator`：根据 seed、owner、worldSalt、scene recipe、butlerConstructionStyle 生成第一版 `HomeMapState`。
- `PlacementEngine`：负责 placement 的规则化摆放、承托、路径、区域关系与布局约束。
- `HomeMapState`：保存 zones、placements、resources、constructionPlans、mapDiffs 等当前家园状态。
- `MapDiff`：记录建设 / 运行带来的增量变化，不覆盖整张地图。
- `ConstructionPlan`：表达管家的建设意图、阶段、目标 zone、资源需求与预期 placements。
- 后续要接入 `LifeCoreProfile` / `VisualProfile`，但本轮不改代码。

## 5. 测试与调试保留清单 KEEP_TEST

| 路径 | 当前用途 | 保留原因 | 后续动作 |
| --- | --- | --- | --- |
| `src/app/personality-test/` | 命理、紫微、八字、动态流、生命趋势、人格解释测试页 | 算法验证入口，绝对不进入删除列表 | 保留 |
| `src/app/world-debug/page.tsx` | 世界调试页 | 调试验证入口 | 保留 |
| `src/app/pixel-layer-test/` | 像素层 / prefab 测试页 | 视觉积木验证入口 | 保留 |
| `src/app/world/WorldConstructionTestControls.tsx` | 世界建设测试控制 | 建设链路调试控件 | 保留 |
| `src/app/world/components/logic-visualization/` | World logic dashboard、MapDiff log、ZoneGraph、F3 逻辑审计 | 开发审计展示，不作为正式主链路 | 保留，可挂到 F3 |
| `src/engine/agent-runtime-audit/` | pet / butler agent runtime audit | agent 运行审计 | 保留 |
| `src/docs/test-artifacts/` | 历史测试截图与 JSON 结果 | 回归证据 | 保留 |
| `src/docs/MVP_FULL_LOOP_TEST_REPORT_2026-05-12.md` | MVP 全链路测试报告 | 历史验证资料 | 保留 |
| `src/docs/MVP_REMAINING_TEST_REPORT_2026-05-12.md` | MVP 剩余测试报告 | 历史缺陷与验证资料 | 保留 |
| `src/docs/ARCH_4_RUNTIME_CHAIN_AUDIT.md` | Runtime chain 审计 | 架构审计资料 | 保留 |
| `src/docs/ARCH_4C_MEMORY_RELATION_LEARNING_AUDIT.md` | Memory / relation / learning 审计 | 架构审计资料 | 保留 |
| 所有包含 `test`、`debug`、`audit`、`dev` 的文件 | 测试、调试、审计或开发标签内容 | 用户明确禁止进入 `DELETE_SAFE` | 保留 |

## 6. 开发辅助保留清单 KEEP_DEV

| 路径 | 当前用途 | 保留原因 | 后续动作 |
| --- | --- | --- | --- |
| `docs/mvp/AI_PET_WORLD_MVP_V1_2_FULL_PLAN.md` | 当前 MVP 主线规划 | 主线文档，需保留 | 后续由架构冻结文档补充命名对齐 |
| `docs/mvp/PIXEL_ASSET_PIPELINE.md` | P0 素材生产管线 | 素材规则主线文档 | 保留 |
| `docs/mvp/PIXEL_WORLD_DESIGN_SYSTEM.md` | 像素世界设计规则 | 主线设计规则 | 保留 |
| `docs/mvp/INITIAL_HOME_SCENE_RECIPE.md` | 初始家园场景 recipe | WorldGeneration 参考文档 | 保留 |
| `docs/mvp/WORLD_TIME_AND_RESOURCE_RULES.md` | 世界时间与资源规则 | worldEngine / systems 规则参考 | 保留 |
| `docs/assets/ASSET_MANIFEST.md` | 素材清单 | 素材审计参考 | 保留 |
| `src/docs/P_PHONE_PRE_AUDIT.md` | P-Phone 接入前审计 | 历史 / 开发审计 | 保留 |
| `src/docs/P_PHONE_BRIDGE_AUDIT.md` | P-Phone bridge 审计 | 历史 / 开发审计 | 保留 |
| `src/systems/pet/*.md` | pet 系统模块架构文档 | 系统开发辅助 | 保留 |
| `src/systems/butler/*.md` | butler 系统模块架构文档 | 系统开发辅助 | 保留 |
| `src/systems/*/README.md` | 子系统说明 | 开发辅助 | 保留 |
| `README.md`、`PROJECT_ARCHITECTURE_V1.md`、`AGENTS.md`、`CLAUDE.md` | 仓库说明、历史架构、agent 规则 | 项目上下文 | 保留 |
| `package.json`、`package-lock.json` | 包管理 | 配置文件，本轮禁止修改 | 保留 |
| `tsconfig.json`、`next.config.ts`、`eslint.config.mjs`、`postcss.config.mjs`、`next-env.d.ts` | 编译 / Next / lint 配置 | 配置文件，本轮禁止修改 | 保留 |
| `.vscode/` | 本地开发配置 | 开发辅助 | 保留 |
| `art-assets/` | 参考图与源 zip | 素材生产辅助 | 保留 |
| `public/*.svg` | 默认静态资源 | 不影响核心，不做删除 | 保留 |

### 文档主线与历史划分

- 当前主线文档：`docs/mvp/AI_PET_WORLD_MVP_V1_2_FULL_PLAN.md`、`docs/mvp/PIXEL_ASSET_PIPELINE.md`、`docs/mvp/PIXEL_WORLD_DESIGN_SYSTEM.md`、`docs/mvp/INITIAL_HOME_SCENE_RECIPE.md`、`docs/mvp/WORLD_TIME_AND_RESOURCE_RULES.md`。
- 历史 / 审计文档：`src/docs/P_PHONE_PRE_AUDIT.md`、`src/docs/P_PHONE_BRIDGE_AUDIT.md`、`src/docs/MVP_*_TEST_REPORT_2026-05-12.md`、`src/docs/ARCH_*_AUDIT.md`。
- 全部保留，不删除。

## 7. 正式入口断开清单 DISCONNECT_UI

| 路径 | 当前用途 | 为什么不进正式 `/world` | 后续动作 |
| --- | --- | --- | --- |
| `src/app/world/components/experience/` | 卡片式世界体验页组件集合 | 正式 `/world` 应是 HomeMapState 驱动的世界主舞台，不是卡片页面 | 从正式入口断开，迁移到 F3 / dev 展示 |
| `src/app/world/components/experience/WorldExperiencePage.tsx` | 组装 hero、pet、butler、home growth、timeline、event feed、controls | 当前是卡片体验页主容器，不是 Renderer | 保留文件，后续不作为 `/world` 主链路 |
| `src/app/world/components/experience/PetPresenceCard.tsx` | 宠物状态卡片 | 正式主舞台应通过 ActorRuntime / Renderer 表达宠物状态 | 迁移到调试侧栏或 F3 |
| `src/app/world/components/experience/ButlerPresenceCard.tsx` | 管家状态卡片 | 正式主舞台应通过 WorldExpression / ActorRuntime 表达管家 | 迁移到调试侧栏或 F3 |
| `src/app/world/components/experience/HomeGrowthOverview.tsx` | 家园成长摘要卡片 | 正式世界应直接呈现地图成长，不用卡片承载主体验 | 迁移到 dev 审计 |
| `src/app/world/components/experience/ConstructionStoryTimeline.tsx` | 建设故事时间线 | 可作为审计 / 调试，不是正式主舞台 | 迁移到 F3 |
| `src/app/world/components/experience/WorldEventStoryFeed.tsx` | 事件故事流 | 正式 UI 不应把事件日志当主体验 | 迁移到 F3 / dev |
| `src/app/world/components/experience/WorldExperienceControls.tsx` | 手动推进 / 重置等 controls | 正式 `/world` 不应暴露开发控制为主体验 | 放入测试 / F3 |
| `src/app/world/components/experience/world-experience-styles.ts` | 卡片体验页样式常量 | 与卡片页绑定 | 随 experience 迁移 |
| `src/world/visualization/build-world-experience-model.ts` | 将 worldState / HomeMapState 包装成卡片体验模型 | 只服务 `WorldExperiencePage` 卡片体验 | 迁移到 dev 审计或停用 |
| `src/world/visualization/world-experience-schema.ts` | 卡片体验模型 schema | 与正式 Renderer 链路不同 | 迁移到 dev 审计或停用 |
| `src/world/visualization/` | visualization mapper 集合 | 若只服务卡片页和逻辑展示，不应进入正式主链路 | 保留，可迁移为 F3 开发审计或调试展示 |

这些文件不直接删除，只是不作为正式 `/world` 主链路。后续可迁移到 F3 开发审计或 dev 页面。

## 8. 后续迁移清单 DEPRECATE_LATER

| 路径/关键词 | 当前引用 | 为什么不能删 | 未来迁移方向 |
| --- | --- | --- | --- |
| `incubator` | `src/types/incubator.ts`、`src/systems/incubatorSystem.ts`、`src/systems/incubator/`、`src/engine/worldEngine.ts`、`src/engine/world-engine/*`、`src/world/persistence/*`、`src/world/adoption/adoption-incubator-adapter.ts` | worldEngine tick、save / restore、systems、F3 审计、adoption adapter 仍依赖 | 迁移到 pet arrival / adoption / 分配时刻；保留旧字段兼容存档 |
| `hatch` | `src/systems/incubator/incubator-hatch-runner.ts`、`src/systems/petSystem.ts`、`src/engine/world-engine/runners/management-interaction-runner.ts`、`src/types/event.ts` | 宠物生成和事件类型仍有引用 | 产品层不显示 hatch，内部迁移为 arrival complete |
| `embryo` | `src/types/incubator.ts`、`src/ai/destiny-core/ziwei-core/evolution.ts`、测试报告 | 仍在旧孵化语义和人格演化注释 / 类型中存在 | 改为 arrival seed / allocation seed / pre-arrival record |
| `孵化` / `胚胎` | docs、types、systems、audit、test reports 多处 | 历史测试和兼容语义仍存在 | 正式 UI 不显示，文档迁移时记录为历史术语 |
| `adoption` | `src/world/adoption/`、`src/world/mvp-check/`、`src/app/world/hooks/useWorldEngineState.ts`、`src/sprite-system/*`、像素 UI adoption center 组件 | adoption 是未来宠物真实抵达 / 分配入口，且当前承接 incubator adapter | 默认 `KEEP_CORE`，逐步替代 incubator 产品语义 |
| `adoptionState` | `worldEngine.getAdoptionState()`、`useWorldEngineState`、MVP check | 当前 Web 状态层已读取 adoption 状态 | 后续成为正式 pet arrival 状态 |
| 旧 P-Phone | `src/docs/P_PHONE_*`、`src/systems/butler/*` 文档和边界 | 当前是开发审计 / 历史边界，不能误删 | 未来独立于 `/world` 主舞台，保持消息边界 |
| F3 developer panel | `useWorldEngineState.showDeveloperPanel`、logic visualization、docs / test reports | 是开发审计入口，测试内容禁止删除 | 继续承接 DISCONNECT_UI 的审计迁移 |
| `src/app/world/components/pixel-ui/` | pixel layer test、原型组件、adoption center / low-fi prefabs | 原型和测试组件可能仍被测试页引用 | 不作为正式 `/world` 主链路，后续确认迁移到 Asset Lab |
| `src/world/renderer/` | Pixi renderer 旧基础：world-scene、pixi-app、camera、asset-loader | 可能是历史 renderer 原型，未作为当前正式 HomeMapRenderer 链路 | 后续确认引用后再决定迁移或归档，不列删除 |
| `src/world/map/`、`src/world/maps/` | 旧 map / initial-home layers | 可能是历史地图原型和数据层 | 后续确认是否迁入 WorldGeneration 或保留为历史 |

正式 UI 不应显示 `hatch` / `embryo` / `incubator` 概念。产品层未来走 pet arrival / adoption / 分配时刻。

## 9. 可安全删除候选 DELETE_SAFE

本轮 `DELETE_SAFE` 为空。

原因：

- 未发现可以在第一轮无风险删除的文件。
- 测试、调试、审计、文档、配置全部禁止进入删除候选。
- `incubator` / `hatch` / `embryo` 虽然产品语义需要迁移，但当前仍被 worldEngine、systems、persistence、audit、tests 引用。
- `experience/*` 与 `visualization/*` 当前仍被 `/world/page.tsx` 引用，因此只能列入 `DISCONNECT_UI`，不能删除。
- 删除前必须再次运行引用检查，并确认不影响 `lint` / `tsc` / `build`。

## 10. /world 当前引用链路

当前链路：

```txt
src/app/world/page.tsx
→ useWorldEngineState
→ generateInitialHomeMap
→ advanceMvpConstructionByWorldTick
→ buildWorldExperienceModel
→ WorldExperiencePage
```

`src/app/world/page.tsx` 当前包含并使用：

1. `generateInitialHomeMap`
2. `localStorage` 快照：`loadHomeMapLocalSnapshot` / `saveHomeMapLocalSnapshot`
3. `advanceMvpConstructionByWorldTick`
4. `currentHomeMapState`
5. `DEFAULT_CONSTRUCTION_STYLE`
6. `buildWorldExperienceModel`
7. `WorldExperiencePage`

目标链路：

```txt
src/app/world/page.tsx
→ useWorldEngineState
→ generateInitialHomeMap
→ buildHomeMapRenderModel
→ HomeMapRenderer
```

说明：本轮不改代码，只记录。`page.tsx` 当前是临时 Web 世界入口，可以暂列 `KEEP_CORE` / `KEEP_DEV`；它应逐步变薄，核心逻辑不继续写死在 app 层。`hooks/useWorldEngineState.ts` 是 Web 临时适配层，负责连接 `worldEngine`、save / restore、offline catchup、F3 状态，也不应继续承载核心业务决策。

## 11. 当前风险点

1. `/world` 仍是卡片体验页，不是纯世界主舞台。
2. `DEFAULT_CONSTRUCTION_STYLE` 是临时写死数据，未来要由 `LifeCoreProfile` 生成。
3. `VisualProfile` / `WorldExpression` / `ActorRuntime` 尚未实现。
4. `incubator` / `hatch` / `embryo` 与未来 adoption / arrival 产品语义存在迁移差异。
5. Web app 层不要继续承载核心逻辑，因为未来要客户端化。
6. 素材资产需要模块化，不做整图原型。
7. `public/assets` 与 `world-map-asset-registry` 大部分对应，但当前 registry 中 3 个 actor 占位路径存在 404 风险：`/assets/generated/world/actors/butler_body_standard_01.png`、`/assets/generated/world/actors/pet_part_body_round_01.png`、`/assets/generated/world/actors/pet_pose_skeleton_idle_front_01.png`。
8. P0 文档命名与 registry 实际路径有差异：例如 edge top / bottom / left / right 在 registry 中映射到现有 `edge_grass_dirt_grass_top_01.png`、`edge_grass_dirt_dirt_top_01.png` 等兼容路径；这是 TODO，不删除。

## 12. 清理执行建议

阶段 1：
只断开正式 `/world` 与卡片体验页，不删除文件。让 `/world` 直接进入 `HomeMapRenderer`，把卡片体验页迁到 F3 / dev。

阶段 2：
补 `docs/mvp/AI_PET_WORLD_ARCHITECTURE_FREEZE.md`，明确当前真实命名：`destiny-core` 是命理核心，`personality-core` 是人格解释 / profile 映射层。

阶段 3：
新增 `LifeCoreProfile` / `VisualProfile` 目录和类型，只做类型与边界，不把逻辑塞进 app 层。

阶段 4：
新增 Asset Module / Asset Lab，对齐 `public/assets`、`world-map-asset-registry`、P0 文档命名和 404 TODO。

阶段 5：
新增 `WorldExpression` / `ActorRuntime`，让 pet / butler 的世界表达从核心 runtime 映射到 Renderer。

阶段 6：
再评估 `DISCONNECT_UI` 是否迁移到 dev 页面或删除。删除前必须再次确认无引用，且不能包含测试、调试、审计、文档、配置、核心。

## 13. 禁止操作

- 不删测试内容。
- 不删命理核心。
- 不删 `worldEngine`。
- 不删 Renderer。
- 不删 `map-state`。
- 不删 `construction`。
- 不删 `incubator`，除非完成迁移且无引用。
- 不把正式 `/world` 做成 HUD / 卡片页。
- 不把原型图当背景图。
- 不把核心逻辑写进 `src/app/page`。
- 不删除 `src/app/personality-test/`。
- 不删除 F3 / debug / audit / dev 内容。
- 不删除 `public/assets/` 或 `public/*.svg`。

## 14. 下一步 Codex 任务建议

下一条任务建议：

```txt
ARCHITECTURE-FREEZE-DOC-01
```

任务目标：新增 `docs/mvp/AI_PET_WORLD_ARCHITECTURE_FREEZE.md`，把冻结主链路、真实目录命名、正式 `/world` 目标链路、DISCONNECT_UI 边界、incubator → adoption 迁移语义写成架构冻结文档。不要执行代码改动。
