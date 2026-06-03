# AI-PET-WORLD

AI-PET-WORLD 是一个由 AI 管家和世界规则共同驱动的自主像素世界。

用户通过注册和出生信息进入世界。出生年月日与可选出生时辰会进入紫微斗数 / 生命人格核心，映射为管家的长期人格、沟通方式、建设偏好和决策倾向。管家不是被玩家直接操控的单位，而是世界中的自主行动者。

## 当前正式主链

```txt
用户注册
-> 提交出生信息
-> 紫微斗数 / 生命人格核心生成管家灵魂
-> 创建个人世界
-> 管家自主观察、判断、建设、沟通和成长
-> 用户通过 P-Phone 与管家建立长期关系
```

用户可以提出建议，但建议不是命令。管家会结合人格、记忆、资源、空间、痕迹和世界规则，自主决定接受、延后、调整或拒绝。

## 视觉主链

画面只表达世界事实，不创造世界事实。

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

视觉判断系统可以修正视觉表达，例如密度、遮挡、比例、可读性、版权风险和风格一致性，但不能篡改 runtime 里的世界事实。

## Runtime 存储边界

正式 runtime 通过 `RuntimeStoreAdapter` 访问存储。

当前开发和 smoke 测试使用 `LocalFileRuntimeStore`，落盘目录为 `data/world-runtime`。生产环境不会默认启用本地文件存储；上线前必须接入正式 `DatabaseRuntimeStore`。

## 文档

- `docs/v2_6/AI_PET_WORLD_V2_6_CURRENT_BUSINESS_PRINCIPLES.md`
- `docs/v2_6/AI_PET_WORLD_CURRENT_ARCHITECTURE.md`
- `docs/v2_6/AI_PET_WORLD_PIXEL_GENERATION.md`
- `docs/v2_6/AI_PET_WORLD_VISUAL_GENERATION_AND_JUDGE_PLAN.md`
- `docs/legal/AI_PET_WORLD_COPYRIGHT_AND_LICENSE_POLICY.md`
