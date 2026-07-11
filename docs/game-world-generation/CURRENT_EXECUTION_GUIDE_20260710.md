# 完整游戏世界生成当前执行指南

更新时间：2026-07-11 12:32:00 +08:00

状态：正式当前执行文档 / 当前主流程已进入代码闸门实现 / 当前 RuntimeFrame 被阻断 / 不代表地图训练成功

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

## 1. 本文档用途

本文档是当前继续工作的唯一执行入口。

后续执行顺序必须先读本文档，再读被本文档引用的下级文档。旧计划、旧进度和旧 `live-world` 文档已经删除，不再保留平行入口。

## 2. 当前结论

当前系统已经补上唯一编排入口、严格结构化数据审计、VisualFactManifest、审核失败学习消费端、动态完整世界视觉任务包和关键闸门，但真实的完整世界视觉推理尚未实现，第一版完整游戏世界地图尚未成功。

当前主入口检查结果：

```text
npm run check:complete-game-world
```

当前状态：

```text
status = blocked
canEnterWorld = false
blockers = owner_review_rejected, data_gap_insufficient,
           model_training_alignment_failed,
           training_data_persistence_failed,
           complete_world_visual_inference_not_implemented
```

含义：

1. 当前 RuntimeFrame 被项目所有者人工拒绝，不能进入 `/world`。
2. 严格审计只计算具备样本记录、真实图片、匹配 hash、正式标签、审核状态和当前字典版本的唯一图片；当前完整地图正样本和负样本均为 0，不能把文件数量或历史 JSON 数量当作训练数据。
3. FormalVisualJudge 通过只代表机器规则曾经通过，不代表最终游戏地图通过。
4. AI Painter 当前图片 API 不允许再直接展示被拒绝 RuntimeFrame。
5. 最新训练归档仍绑定旧字典 `mvp-natural-home-v0.1`，与当前 `mvp-natural-home-v0.3` 不一致，持久化检查必须继续阻断，不能把旧归档冒充当前训练证据。

## 3. 唯一主入口

完整游戏世界生成编排的唯一入口是：

```text
npm run run:complete-game-world
```

检查版入口是：

```text
npm run check:complete-game-world
```

只打印执行计划、不写业务数据的入口是：

```text
npm run plan:complete-game-world
```

`run` 执行当前允许的写入和检查；`check` 只执行只读检查；`plan` 只打印步骤。主流程依次建立严格数据审计、当前 VisualFactManifest、世界导演输出和完整视觉任务包。真实完整视觉推理接入前，它必须返回 `complete_world_visual_inference_not_implemented`，不得读取旧图后宣称本轮完成了生成。

材料槽、局部训练、v46/v50/v52 等脚本只能作为从属步骤，不能作为完整游戏世界主入口。旧 5×5 Chunk、P10-P17、管家和生态路线的 npm 命令已统一返回 `retired_live_world_command_blocked`，历史文件仅作证据保存。

## 4. 正式文档层级

当前正式文档根目录：

```text
docs/game-world-generation/
```

当前执行入口：

```text
docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md
```

正式下级规格只保留以下 3 份。后续智能体不得再从阶段性文档自行拼装路线：

| 层级 | 文档 | 用途 |
|---|---|---|
| AI Painter 实现 | `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` | VisualFactManifest、世界导演、条件编译、多尺度能力、完整地图推理和验证体系 |
| 训练数据与来源 | `TRAINING_DATA_AND_SOURCE_POLICY.md` | 样本来源、Schema、数据包、严格计数、自动保存和数据库迁移 |
| 审核与自动化 | `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` | 审核门、失败回写、自主循环、实时状态、控制台和存储 |

`docs/world-visual-data-dictionary/` 是机器参考。默认只读 `README.md`、`data/world-visual-data-dictionary/latest.json` 和当前任务明确涉及的条目，禁止全量读取后自由组合新路线。

## 5. 当前已处理的问题

| 编号 | 问题 | 当前处理状态 | 证据 |
|---|---|---|---|
| P0 | 没有唯一完整游戏世界生成编排入口 | 编排入口已处理，真实推理未完成 | `npm run run:complete-game-world` 会刷新审计、保存任务包并阻断未实现的完整视觉推理 |
| P0 | 模型训练架构未对齐 | 检查方式已处理，能力仍未完全对齐 | `npm run check:ai-painter-model-training-alignment` 现在核验真实命令、代码和产物，并因完整视觉推理缺失而正确失败；失败学习消费端已经实现 |
| P1 | 控制台状态会误报通过 | 已处理 | 控制台 API 读取 owner review，拒绝时不再 ready |
| P1 | AI Painter 图片 API 展示被拒绝 RuntimeFrame | 已处理 | 被拒绝图返回 404 |
| P1 | FormalVisualJudge 不够专业 | 已处理第一轮 | 增加灰绿伪装补丁等阻断 |
| P1 | 文档承认数据不够 | 已处理为硬阻断 | `data_gap_insufficient` 阻断主入口 |
| P2 | 文档治理混乱 | 已处理 | `docs/DOCUMENT_AUTHORITY_INDEX.md` 已建立，旧根计划、旧进度和旧 live-world 文档已删除 |
| P1 | 旧 live-world HTTP 控制入口仍开放 | 已处理 | 旧候选和图片 API 返回 410，不再参与当前控制面 |
| P1 | 旧 live-world npm 命令仍可执行 | 已处理 | 41 个旧 5×5/P10-P17/管家/生态命令统一返回 `retired_live_world_command_blocked` |
| P1 | 数据审计按文件数虚增样本 | 已处理 | v2 审计要求正式样本记录、真实图片、匹配 hash、标签、审核和当前字典版本；当前正样本 0、负样本 0 |
| P1 | 世界视觉任务写死场景字段并混入后置事实 | 已处理 | `VisualFactManifest` 先筛选当前可见事实，导演字段由当前结构动态推导 |
| P1 | `check` 实际执行写操作 | 已处理 | `check` 只读、`plan` 只打印、`run` 才执行当前允许写入 |

## 6. 当前未完成的问题

这些不是已经成功，而是下一阶段必须继续处理的内容：

| 优先级 | 未完成项 | 为什么重要 |
|---|---|---|
| P0 | 数据缺口未闭合 | 没有足够完整地图正样本、负样本、过渡样本，小模型不知道最终应该长什么样 |
| P0 | 真实完整世界视觉推理未实现 | 任务包已经自动保存，但尚不能产生本轮完整地图新图；已有 RuntimeFrame 只作为输入证据 |
| P0 | 完整地图候选仍不能通过 owner review | 当前图被人工拒绝，不能进入 `/world` |
| P1 | FormalVisualJudge 仍需继续从失败样本学习 | 已加一轮规则，但还不是完整专业审美模型 |
| P1 | 控制台实时监控需要继续严格化 | 已实现 25 秒周期实时状态、子进程 PID 存活检查和 3 秒非重入状态流；仍需在真实长任务中完成持续验收 |
| P1 | 子文档状态迁移 | 已处理；下级文件统一标记为 `architecture-spec`，实现事实只读取当前执行指南和程序检查 |

## 7. 下一步执行顺序

下一步不能再盲目训练局部材料。

必须按下面顺序走：

1. 文档治理收口：所有当前入口指向本文档。
2. 数据蓝图刷新：运行 `npm run build:complete-map-data-blueprint`。
3. 数据缺口审计：运行 `npm run audit:complete-map-data-sufficiency`，审计必须绑定当前字典版本。
4. 训练数据打包：按 `TRAINING_DATA_AND_SOURCE_POLICY.md` 建立完整地图正样本、负样本、过渡样本、对象接地样本和审美标签。
5. 视觉事实清单：运行 `npm run build:current-world-visual-fact-manifest`，只允许当前范围内真实可见事实进入生成链路。
6. 失败学习消费与世界视觉任务包：运行 `npm run consume:game-map-visual-learning-feedback` 后，由 `npm run build:current-world-visual-task-package` 自动保存 VisualFactManifest、导演输出、地图结构、失败记忆和视觉版本的统一输入；完整世界主入口已自动编排这些步骤。
7. 按 `AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md` 实现视觉条件编译器；字典字段必须进入模型条件，而不只进入审核器。
8. 数据缺口满足后，接入真实完整视觉推理；不得复用旧图冒充生成。
9. 按 `REVIEW_AUTOMATION_AND_STORAGE_SPEC.md` 继续加强 FormalVisualJudge、专业审美判断和 owner review 回写。
10. 主入口运行：只通过 `npm run run:complete-game-world` 推进完整世界流程。
11. 如果 owner review 需要人工确认，程序必须停止等待项目所有者。

## 8. 成功定义

第一版完整游戏世界地图成功必须同时满足：

1. 完整地图数据包可追溯。
2. 本地小模型输出完整 RuntimeFrame 候选。
3. RuntimeFrame 不是局部 crop，不是材料测试图。
4. MaterialQuality 通过。
5. FormalVisualJudge 通过。
6. 专业审美失败模式无阻断。
7. 项目所有者人工终审通过。
8. `/world` 只读取通过终审的 RuntimeFrame。
9. 全过程记录自动保存到 `.runtime`，不是 Codex 手写替代。

## 9. 禁止事项

1. 不允许把局部材料训练当作完整世界训练成功。
2. 不允许把 FormalVisualJudge 通过当作最终成功。
3. 不允许展示 owner rejected RuntimeFrame 作为当前可用地图。
4. 不允许读取旧 running 状态假装实时运行。
5. 不允许绕过 `docs/game-world-generation/` 直接按旧文档自由发挥。
6. 不允许把没有自动保存的数据当作正式训练数据。
7. 不允许在数据缺口未闭合时宣布第一版世界地图完成。
8. 不允许建立“项目内部视觉教师”或让程序直绘图成为专业完整地图正样本。
9. 不允许写死未经实验验证的模型数量、数据规模和工期。

## 10. 当前检查命令

每次继续前先跑：

```text
npm run check:ai-painter-model-training-alignment
npm run build:complete-map-data-blueprint
npm run audit:complete-map-data-sufficiency
npm run check:complete-game-world
```

如果 `check:complete-game-world` 返回 `blocked`，说明系统没有坏，而是当前流程正确阻断。阻断原因必须作为下一步任务来源。

## 11. 2026-07-10 控制台稳定性修复记录

本节是当前执行文档的一部分，禁止后续实现退回旧行为。

| 编号 | 已处理问题 | 固定实现规则 | 验证结果 |
|---|---|---|---|
| P1 | 训练进度轮询重入 | SSE 和前端降级轮询必须等待上一轮完成，再延迟 3 秒；禁止使用 1 秒异步 `setInterval` | TypeScript 与 lint 通过；摘要响应约 5 KB |
| P1 | 重型状态接口重复扫描 | 完整状态快照使用 3 秒共享缓存；SSE 只发送状态摘要 | 完整响应约 3.18 MB，SSE 摘要约 5 KB |
| P1 | 长任务实时状态过期 | 控制器每 25 秒刷新实时状态；控制状态记录同时保存真实启动的子进程 PID | 已进入代码实现；待下一次真实长任务持续验收 |
| P1 | 生产构建追踪训练产物 | `.runtime` 不得进入 `training-data-image` 路由生产文件追踪清单 | NFT 从 142,400,589 字节降至 268,128 字节 |
| P2 | GET 页面修改业务台账 | `/ai-painter-progress/natural-home` 只读现有证据；刷新页面不得写 `latest.json` 或历史快照 | 页面访问前后台账修改时间保持一致 |

控制台只是读取器。训练、推理、审核、失败回写和晋级事件仍由程序自动保存，页面访问不得成为业务事件。

已知后续项：生产构建仍会报告 `world-visual-dictionary-trials/image` 导入链上的宽泛文件匹配警告，来源涉及 `generated-results` 和 `natural-home` 的动态目录扫描。当前该路由 NFT 约 278 KB，不是本次 67 万运行文件追踪问题，但后续必须把共享读取逻辑从页面模块迁入独立只读服务，消除构建警告。
