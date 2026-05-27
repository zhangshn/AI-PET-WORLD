# AI-PET-WORLD

当前项目唯一有效的 V2.6 正式文档入口：

- `docs/v2_6/README.md`
- `docs/v2_6/AI_PET_WORLD_V2_6_BUSINESS_ARCHITECTURE.md`
- `docs/v2_6/AI_PET_WORLD_V2_6_RULE_BASED_AI_PIXEL_IMPLEMENTATION.md`
- `docs/v2_6/AI_PET_WORLD_V2_6_AUTONOMOUS_WORLD_GENERATION_ALGORITHM.md`
- `docs/v2_6/AI_PET_WORLD_V2_6_PIXEL_WORLD_RENDERING_ALGORITHM.md`
- `docs/v2_6/AI_PET_WORLD_V2_6_MODULE_PROGRESS.md`

后续任务必须以 `docs/v2_6` 为准。

当前红线：

- `/world` 是 PixelWorldView，不是 SVG、Debug composer、WorldPainterReadonlyPreview、FormalWorldView 或 ProceduralRendererView。
- Pixel Scene Composer 只作为 `/world-debug` 规则实验室。
- WorldViewModel 是正式表现模型。
- PixelWorldView 只读 WorldViewModel。
- 当前阶段不训练大模型。
- 不设置独立 road/path 架构。
- 宠物不默认进入世界。

