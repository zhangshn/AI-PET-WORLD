# AI-PET-WORLD 当前进度表

状态：实时进度文档  
更新时间：2026-06-29

本文只记录当前完成度、阻塞和下一步。总入口见 [README](../README.md)，执行顺序见 [唯一执行计划表](./EXECUTION_PLAN.md)。

## 当前阶段

当前阶段：P4 / P5 交界  
当前主线：自然家园小模型训练 + 自然家园 VisualJudge + Game-World ApprovedFrame 候选 + RuntimeFrame 闸门  
当前结论：`/world` 已修正为完整游戏主世界入口，不再展示训练候选图、局部图、crop、patch、tile、sprite、Controlled MVP 图，也不允许把单张 ApprovedFrame 图片直接铺成主页面。ApprovedFrame 只能作为 RuntimeFrame 的视觉输入，必须经过游戏界面合成层后才可能进入 `/world`。

## 当前进度表

| 模块 | 状态 | 完成度 | 当前说明 |
|---|---:|---:|---|
| 业务主线定义 | 完成 | 100% | 自主世界、自主管家、世界事实优先已固定。 |
| 文档入口整理 | 进行中 | 90% | README、计划表、进度表已重新清理；后续只更新必要文档。 |
| 本地训练工程 | 可运行 | 96% | PyTorch/CUDA/训练/推理/记录链路已接通。 |
| 训练结果归档 | 已接通 | 96% | 成功图、失败图、候选图、时间戳、耗时、资源账本进入归档链路。 |
| 自然家园数据范围 | 已冻结 | 100% | 当前只做草地、水体、水岸、道路、树、石、花草、空间深度。 |
| 自然家园小模型训练 | 进行中 | 94% | V110 是当前稳定权重；V112 使用 V110 稳定权重扩大候选池。 |
| 自然家园完整帧生成 | 进行中 | 91% | V116 扩展 formal-world 来源到 180 张候选，VJ-2 得到 43 张自然质量候选；V117 完整主世界闸门确认 0/180 可作为完整 `/world` 主世界帧。 |
| V112 候选绑定复核 | 完成 | 100% | 曾绑定一个候选用于复核；视觉检查后确认不能作为正式 `/world` 画面，不写入正式展示源。 |
| VisualJudge VJ-0 | 完成 | 100% | 文件、来源、hash、runtime gate、ApprovedFrame 记录闸门完成。 |
| VisualJudge VJ-1 | 进行中 | 97% | V116 筛出 94 张 VJ-1 候选，剩余失败集中在锐度、水体伪影、边界密度和来源状态。 |
| VisualJudge VJ-2 | 进行中 | 91% | V116 通过 43 张自然质量候选；现有 VJ-2 仍是自然质量筛选，下一步必须补完整主世界构图判断。 |
| Game-World Frame Gate | 已建立 | 100% | V117 新增完整游戏主世界帧闸门；当前 V116 的 180 张全部被正确阻断。 |
| Game-World ApprovedFrame | 协议已打通 | 88% | 当前没有正式可展示帧；V112 只是候选绑定，不是最终批准。 |
| RuntimeFrame 闸门 | 已收紧 | 100% | `/world` 只允许完整游戏 RuntimeFrame；单张 ApprovedFrame 不能直接展示。 |
| `/world` 正式展示 | 已阻断未合格内容 | 92% | 当前没有正式 RuntimeFrame，所以 `/world` 应显示阻断说明，不展示图。 |
| VisualUnit v0 | 暂停 | 25% | schema 和样例已有，judge 后置。 |
| 人物 / 管家视觉单元 | 未开始 | 0% | 后置。 |
| 设施 / 建筑视觉单元 | 未开始 | 0% | 后置。 |
| 动态状态帧 | 未开始 | 0% | 后置。 |
| Runtime 动态合成 | 未开始 | 0% | 后置。 |

## 最新批次结果

| 批次 | 数据范围 | 结果 | 结论 |
|---|---:|---:|---|
| V104 full-frame formal world | 24 张 full-frame 候选 | 12/24 过 VJ-1，0/24 过 VJ-2 | 第一轮完整自然家园候选。 |
| V105 full-frame stability | 60 张 full-frame 候选 | 28/60 过 VJ-1，0/60 过 VJ-2 | 稳定性提升。 |
| V106 full-frame stability repair | 60 张 full-frame 候选 | 0/60 过 VJ-1 | 失败轮，已归档。 |
| V107 formal-passed distillation | 60 张 full-frame 候选 | 28/60 过 VJ-1，0/60 过 VJ-2 | 恢复基线。 |
| V108 V107-weight formal world | 60 张 full-frame 候选 | 28/60 过 VJ-1，0/60 过 VJ-2 | 与 V107 持平。 |
| V109 pure-natural formal world | 60 张 full-frame 候选 | 44/60 过 formal VJ-1，44/60 过 minimal VJ-2 | 曾写入首帧协议，但缺最终业务确认，已移入 rejected archive，不能展示。 |
| V110 V109 formal-passed distillation | 72 张 full-frame 候选 | 53/72 过 formal VJ-1，53/72 过 minimal VJ-2 | 当前稳定训练权重。 |
| V111 V110 failure repair | 72 张 full-frame 候选 | 0/72 过 formal VJ-1/VJ-2 | 训练拉偏，失败记录保留，不采用。 |
| V112 V110 stable formal-world sweep | 96 张候选 | 68/96 过 formal VJ-1，旧 minimal VJ-2 过线偏松 | 候选池可用，但不能直接代表完整主世界。 |
| V112 candidate binding | 1 个候选 | 绑定 worldId/tick/sourceFactIds 成功 | 复核后确认不能写入 `/world`，保留记录。 |
| V113 strict visible semantic VJ-2 | 96 张候选 | 0/96 通过 | 规则过严且把水体误算成绿色，失败轮保留。 |
| V114 corrected visible semantic VJ-2 | 96 张候选 | 40/96 通过 | 得到自然质量候选池；仍需 V115 增加完整主世界构图闸门。 |
| V115 complete-world composition sweep | 96 张候选 | 68/96 过 formal VJ-1，40/96 过修正 VJ-2 | 与 V114 持平，未突破完整主世界构图问题；不写入 `/world`。 |
| V116 expanded formal-world composition | 180 张候选 | 157/180 过训练质量筛选，94/180 过 formal VJ-1，43/180 过修正 VJ-2 | formal-world 来源从 96 扩展到 180；自然质量候选增加，但人工复核仍是局部自然画面，不是完整游戏主世界帧；不写入 `/world`。 |
| V117 complete game-world frame gate | 180 张候选 | 0/180 通过 | 新增完整主世界帧闸门；所有 V116 候选因缺少完整世界意图标签、构图锚点和 RuntimeFrame 来源声明被阻断，符合 `/world` 规则。 |

## 当前正式展示规则

`/world` 是玩家主世界页面，不是训练预览页，也不是单张图片展示页。画面要进入 `/world`，必须同时满足：

| 闸门 | 必须满足 |
|---|---|
| VJ-0 | 文件、来源、hash、runtime 绑定通过。 |
| VJ-1 | 视觉质量通过。 |
| VJ-2 | 自然家园语义、风格、完整世界帧判断通过。 |
| 当前 Runtime | worldId、tick、sourceFactIds 匹配。 |
| 图片绑定 | image hash、字节数、Content-Type、payload quality 匹配。 |
| 正式世界边界 | `approved_for_game_world`、`game_world_ready_for_player`、`formal_full_world_frame`。 |
| 项目最终确认 | 必须包含 `owner_final_world_mvp_approved`、`complete_game_world_scene`、`world_home_playable_frame`。 |
| 游戏界面合成层 | 必须生成 RuntimeFrame / 游戏视口 / 游戏 UI 容器，不能把 ApprovedFrame 图片直接铺满页面。 |

当前正式 ApprovedFrame 源为空。V112/V114 仍是候选和复核记录，不能被 `/world` 读取或展示。

## 最新验证结果

| 命令 | 结果 |
|---|---|
| `npm run check:vj0` | 通过，90 项。 |
| `npm run test:vj0` | 通过，19 项。 |
| `node scripts/check-natural-home-approved-frame-candidate-binding.mjs .runtime\ai-painter\natural-home-v112-approved-frame-candidate-binding natural-home-v112-approved-frame-candidate-binding` | 通过。 |
| `npm run check:encoding` | 通过。 |
| `node scripts/check-natural-home-current-mvp-vj2.mjs .runtime\ai-painter\natural-home-v114-v112-visible-semantic-corrected-vj2-review natural-home-v114-v112-visible-semantic-corrected-vj2-review` | 通过，96 行，40 个自然质量候选。 |
| `node scripts/check-natural-home-current-mvp-vj2.mjs .runtime\ai-painter\natural-home-v115-v110-complete-world-composition-sweep-formal-vj2-review natural-home-v115-v110-complete-world-composition-sweep-formal-vj2-review` | 通过，96 行，40 个自然质量候选。 |
| `node scripts/check-natural-home-current-mvp-vj2.mjs .runtime\ai-painter\natural-home-v116-expanded-formal-world-composition-formal-vj2-review natural-home-v116-expanded-formal-world-composition-formal-vj2-review` | 通过，180 行，43 个自然质量候选。 |
| `node scripts/check-natural-home-game-world-frame-gate.mjs .runtime\ai-painter\natural-home-v117-complete-game-world-frame-gate natural-home-v117-complete-game-world-frame-gate --expect-no-passed` | 通过，180 行，0 个完整主世界候选。 |
| `npx tsc --noEmit` | 通过。 |
| `npm run build` | 通过。 |

## 当前下一步

| 顺序 | 下一步 | 完成标准 |
|---:|---|---|
| 1 | 建立 V118 完整主世界构图数据源 | 生成带 `complete_natural_home_mvp`、`primary_world_view`、`runtime_frame_source` 标签和 6 个构图锚点的 Blueprint。 |
| 2 | 用 V118 数据源生成新的完整自然家园候选 | 必须包含入口、主路径、水岸、自然边界、可探索区域、视觉中心，不做人物、建筑、动态。 |
| 3 | 继续保留所有成功/失败/候选记录 | 每轮自动保存图、时间戳、耗时、GPU、hash、来源、失败原因。 |
| 4 | 通过 VJ-1、VJ-2、Game-World Frame Gate | 只有三层都过，才进入候选绑定复核。 |
| 5 | 项目所有者最终确认后才写入展示标签 | 没有最终确认标签，永远不能进入 `/world`。 |

## 固定提醒

`/world` 是玩家主世界页面，不是训练预览页，也不是图片画廊。任何局部图、crop 图、patch 图、tile 图、sprite 图、训练图、候选图、失败图，即使视觉分数高，也只能归档，不能展示在 `/world`。单张 ApprovedFrame 图片也不能直接等同于 `/world`，它只能作为 RuntimeFrame 合成层的视觉输入。
