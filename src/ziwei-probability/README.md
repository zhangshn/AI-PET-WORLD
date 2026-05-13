# Ziwei Probability System

当前目录负责：把 14 主星 + 24 组合解释成概率倾向。

紫微斗数是 AI-PET-WORLD 的主核心。

八字只作为出生时间缺失时的辅助补全机制。

本模块输出 `ZiweiProbabilityProfile`。

当前链路：

```txt
14 主星 + 24 组合
↓
ZiweiProbabilityProfile
↓
PreferenceProfile
↓
VisualDNA
```

当前 MVP 不接真实完整紫微盘，只建立解释规则和 mock 输入。
