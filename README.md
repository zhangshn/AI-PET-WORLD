# AI-PET-WORLD

AI-PET-WORLD 是一个由 AI 管家自主运行、由世界规则驱动并持续演化的像素世界。

## 当前业务主链

```txt
用户注册
-> 提交出生年月日与可选出生时间
-> 紫微斗数 / 生命人格核心映射管家的灵魂与长期人格
-> 系统生成个人世界
-> 管家自主观察、判断、建设、沟通和成长
-> 用户通过 P-Phone 与管家建立长期关系
```

用户可以提出建议，但不能直接控制管家。管家会依据人格、记忆、资源、空间、痕迹和世界规则，自主决定接受、延后、调整或拒绝。

未来的小镇和城市由不同玩家的管家在规则约束下共同建设。

## 当前正式画面链路

```txt
WorldRuntimeSaveRecord
-> WorldViewModel
-> VisualGenerationPlan
-> PixelWorldRenderPlan
-> PixelWorldPixelBufferFrame
-> VisualJudgeReport
-> VisualCorrectionPlan
-> PixiJS
```

画面只表现世界事实，不创造世界事实。正式 `/world` 不推进 tick、不写 runtime、不生成默认内容。

## 文档

- `docs/v2_6/AI_PET_WORLD_V2_6_CURRENT_BUSINESS_PRINCIPLES.md`
- `docs/v2_6/AI_PET_WORLD_CURRENT_ARCHITECTURE.md`
- `docs/v2_6/AI_PET_WORLD_PIXEL_GENERATION.md`
- `docs/v2_6/AI_PET_WORLD_VISUAL_GENERATION_AND_JUDGE_PLAN.md`
- `docs/legal/AI_PET_WORLD_COPYRIGHT_AND_LICENSE_POLICY.md`
