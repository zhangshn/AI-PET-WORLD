# AI-PET-WORLD V2.6 正式文档入口

本目录是当前 V2.6 唯一有效业务与架构文档入口。

旧 engine-notes、旧 procedural renderer、旧 debug view、旧 MVP closeout、旧 doc / docx / xmind / txt 导出文档全部废弃，不再作为当前开发依据。

## 文档列表

| 文档 | 职责 |
|---|---|
| `AI_PET_WORLD_V2_6_BUSINESS_ARCHITECTURE.md` | V2.6 业务总纲，来自完整业务架构总图强化版 |
| `AI_PET_WORLD_V2_6_RULE_BASED_AI_PIXEL_IMPLEMENTATION.md` | 无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案 |
| `AI_PET_WORLD_V2_6_AUTONOMOUS_WORLD_GENERATION_ALGORITHM.md` | 自主世界生成算法：事实、规则、空间、生态、痕迹、时间线 |
| `AI_PET_WORLD_V2_6_PIXEL_WORLD_RENDERING_ALGORITHM.md` | 正式像素主世界绘制算法：WorldViewModel → PixelWorldView |
| `AI_PET_WORLD_V2_6_MODULE_PROGRESS.md` | 当前模块进度表与下一步路线 |

## 当前红线

- `/world` 是 PixelWorldView，不是 SVG / Debug composer。
- Pixel Scene Composer 是规则实验室，只能存在于 `/world-debug` 或同等调试场景。
- WorldViewModel 是正式表现模型。
- PixelWorldView 只读 WorldViewModel。
- 当前阶段不训练大模型。
- 不设置独立 road/path 架构，长期移动结果归入痕迹体系。
- 宠物不默认进入世界。
- 管家行为闭环、宠物学习、世界学习尚未完成，不得写成已完成能力。

