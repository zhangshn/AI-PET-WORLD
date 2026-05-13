# Preference System

当前目录负责：把紫微概率解释转成高概率潜在喜好画像。

喜好系统不是问卷系统。

`PreferenceProfile` 是由紫微概率解释推导出的高概率潜在喜好画像。

它负责把 `ZiweiProbabilityProfile` 翻译成：

- 颜色偏好
- 宠物偏好
- 管家形象偏好
- 家园偏好
- 花园偏好
- 照护偏好
- 氛围偏好
- 互动偏好

后续 `VisualDNA` 应该优先来自 `PreferenceProfile`，而不是直接从 6 个 archetype 写死。

八字只在出生时间缺失时辅助补全。
