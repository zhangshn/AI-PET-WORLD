# Visual System

当前目录负责：紫微视觉变体系统。

当前不接真实紫微算法，也不接真实八字算法。

当前先用 6 个 MVP archetype 验证不同玩家可以生成不同视觉方向：

- `structured_builder`
- `warm_caretaker`
- `protective_keeper`
- `aesthetic_organizer`
- `quiet_maintainer`
- `adaptive_planner`

紫微斗数是 AI-PET-WORLD 的主核心。

八字只在出生时间缺失时辅助补全，不作为并列核心。

当前完整链路：

```txt
ZiweiProbabilityProfile
↓
PreferenceProfile
↓
VisualDNA
↓
SpriteVariant
↓
PrefabVariant
↓
SceneLayout
```

`VisualDNA` 负责连接命理结果和视觉系统。它会进一步生成：

- `SpriteVariant`
- `PrefabVariant`
- `SceneLayoutVariant`

后续真实 personality-core 接入后，会把紫微人格结果映射成 `VisualDNA`。
