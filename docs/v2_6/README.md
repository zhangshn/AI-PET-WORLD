# AI-PET-WORLD V2.6 当前文档入口

本目录只保留当前有效的业务、架构与画面生成文档。历史方案、阶段 closeout、审查快照和迁移计划不再保留。

## 当前文档

| 文件 | 用途 |
|---|---|
| `AI_PET_WORLD_V2_6_BUSINESS_ARCHITECTURE.md` | 完整业务架构与系统边界 |
| `AI_PET_WORLD_V2_6_CURRENT_BUSINESS_PRINCIPLES.md` | 当前产品定义与工程判断基线 |
| `AI_PET_WORLD_V2_6_RULE_BASED_AI_PIXEL_IMPLEMENTATION.md` | 规则型 AI 自主世界与像素表现落地方案 |
| `AI_PET_WORLD_V2_6_PIXEL_WORLD_RENDERING_ALGORITHM.md` | 正式像素主世界绘制算法 |
| `../visual/AI_PET_WORLD_FORMAL_PIXEL_DRAWING_SYSTEM_PLAN.md` | 当前画面自动生成系统设计 |

## 当前红线

- 用户注册并提交出生信息后，由紫微斗数映射管家灵魂与长期人格倾向。
- 管家是自主行动者。用户通过游戏内 P-Phone 沟通和提出建议，但建议不是命令。
- 世界依据规则、资源、空间、痕迹、记忆和时间线自主演化。
- 未来小镇与城市由不同玩家的管家在规则约束下共同建设，不由玩家直接摆放。
- 正式 `/world` 只读取 `WorldViewModel`，并通过 PixiJS `PixelWorldView` 表现世界。
- Debug 绘图实验只能存在于 `/world-debug`，不能成为正式主世界入口。
- 当前画面不依赖仓库内静态 PNG 素材包。
- 不恢复旧页面、旧渲染入口、旧阶段方案或兼容冻结层。
