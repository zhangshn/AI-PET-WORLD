# AI-PET-WORLD

AI-PET-WORLD 是一个由 AI 管家自主运行、由规则驱动持续演化的像素世界。

## 当前业务

```txt
用户注册
→ 提交出生年月日等生命信息
→ 紫微斗数映射管家的灵魂与长期人格
→ 系统生成个人世界
→ 管家自主观察、判断、建设、沟通和成长
→ 用户通过 P-Phone 与管家建立长期关系
```

用户可以提出建议，但不能直接控制管家。未来小镇和城市由不同玩家的管家在规则约束下共同建设。

## 当前画面链路

```txt
WorldRuntimeSaveRecord
→ WorldViewModel
→ PixelWorldView
→ Pixel Buffer
→ PixiJS
```

画面只表现世界事实，不创造世界事实。

## 文档

- `docs/v2_6/AI_PET_WORLD_V2_6_CURRENT_BUSINESS_PRINCIPLES.md`
- `docs/v2_6/AI_PET_WORLD_CURRENT_ARCHITECTURE.md`
- `docs/v2_6/AI_PET_WORLD_PIXEL_GENERATION.md`
