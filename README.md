# AI-PET-WORLD

当前项目文档已经重置为 V2.6 正式口径。

唯一有效入口：

- `docs/v2_6/README.md`

当前标准来源：

- `AI-PET-WORLD V2.6｜完整业务架构总图（强化版｜含正式像素主世界绘制方案）`
- `AI-PET-WORLD V2.6｜无大数据训练阶段：规则型 AI 自主世界与像素表现落地方案`
- `AI-PET-WORLD V2.6｜正式像素主世界绘制算法`

红线：

- `/world` 是 PixelWorldView。
- Pixel Scene Composer 是 `/world-debug` 规则实验室。
- WorldViewModel 是正式表现模型。
- PixelWorldView 只读 WorldViewModel。
- 当前阶段不训练大模型。
- 不设置独立 road/path 架构。
- 宠物不默认进入世界。
