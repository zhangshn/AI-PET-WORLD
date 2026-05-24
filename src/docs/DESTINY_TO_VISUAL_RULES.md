> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

> Status: must follow V2.0 FormalVisualModel First. Assets and UI may express world facts, but must not generate world facts.

# AI-PET-WORLD 紫微斗数到视觉映射规则 v0.1

## 1. 最高原则

紫微斗数不是只生成文字性格，而是驱动：

- 管家人格
- 管家初始形象
- 宠物匹配
- 宠物外观倾向
- 家园风格
- 建筑倾向
- 花园倾向
- 颜色倾向
- 管家建设优先级

八字仅作为出生时间缺失时的辅助补全机制，不与紫微斗数并列。

## 2. 输入优先级

### 优先级 1：完整真实出生信息

- 真实出生年月日
- 真实出生时间
- 后续可扩展出生地 / 时区
- 使用紫微斗数主算法

### 优先级 2：出生时间缺失或不确定

- 使用八字辅助补全基础人格倾向。
- 用于降低信息缺失带来的偏差。
- 不取代紫微斗数主核心地位。

### 其他输入

- 宠物抵达家园的真实时间。
- 世界阶段。
- AI 世界时间。
- 当前资源状态。

## 3. 输出

### DestinyProfile

- `coreTemperament`：核心气质。
- `emotionalPattern`：情绪模式。
- `actionPattern`：行动模式。
- `relationshipPattern`：关系模式。
- `stabilityPattern`：稳定性模式。
- `currentPhase`：当前阶段。
- `dataConfidence`：数据可信度。
- `fallbackSource`：是否使用辅助补全来源。

### ButlerSoulProfile

- `managementStyle`：管理风格。
- `careStyle`：照护风格。
- `buildingPreference`：建设偏好。
- `communicationTone`：沟通语气。
- `riskTolerance`：风险容忍度。
- `orderPreference`：秩序偏好。

### VisualDNA

- `colorTone`：主色倾向。
- `bodyShape`：角色体型倾向。
- `clothingStyle`：服装倾向。
- `homeStyle`：家园风格。
- `gardenStyle`：庭院风格。
- `buildingStyle`：建筑风格。
- `petMatchType`：宠物匹配类型。
- `atmosphere`：世界氛围。

### PetMatchProfile

- `preferredPetTemperament`：偏好的宠物气质。
- `preferredPetBodyShape`：偏好的宠物体型。
- `preferredPetEnergyLevel`：偏好的宠物能量水平。
- `preferredAttachmentStyle`：偏好的依恋方式。
- `preferredPetVisualTone`：偏好的宠物视觉色调。

### HomeStyleProfile

- `structurePreference`：结构偏好。
- `gardenPreference`：庭院偏好。
- `pathPreference`：路径偏好。
- `shelterPreference`：住所偏好。
- `decorationPreference`：装饰偏好。
- `careCornerPreference`：照护角偏好。

## 4. 紫微斗数到管家初始形象

管家不是随机角色。管家是用户生命信息生成的自主意识管理者。

管家初始形象应该体现用户当前阶段和底层气质：

- `structured_builder`：衣着整齐、轮廓稳定、线条清楚。
- `warm_caretaker`：暖色、柔和、照护感强。
- `protective_keeper`：更重视边界、工具、安全感。
- `aesthetic_organizer`：花草、装饰、柔和布局。
- `quiet_maintainer`：低调、稳定、暗色或柔和色。
- `adaptive_planner`：混合风格，根据资源和宠物状态调整。

## 5. 紫微斗数到宠物匹配

宠物不是随机给。宠物类型应根据用户紫微斗数解析和当前阶段匹配。

匹配维度：

- 情绪互补
- 能量平衡
- 陪伴方式
- 互动节奏
- 视觉喜好
- 用户当前阶段需要

示例：

- 情绪敏感型用户更适合稳定、依恋型宠物。
- 行动力强但波动大的用户更适合观察型、稳定型宠物。
- 秩序型用户更适合清晰行为节奏的宠物。
- 温和照护型用户更适合柔软、亲近、低攻击性的宠物。

## 6. 紫微斗数到家园风格

家园不是玩家手动选择模板。家园风格由紫微管家人格、资源状态、宠物需求共同生成。

示例：

- `structured_builder`：路径更直、地基更清楚、储物区更早出现。
- `warm_caretaker`：宠物床、食物角、水盆、暖光更早出现。
- `protective_keeper`：围栏、观察点、边界更早出现。
- `aesthetic_organizer`：花园、装饰、窗光、树木布局更明显。
- `quiet_maintainer`：低调、稳定、耐久、安静区域。
- `adaptive_planner`：根据宠物状态和资源动态变化。

## 7. 八字辅助补全规则

八字只在以下情况下启用：

- 用户不知道出生时间。
- 用户出生时间不确定。
- 紫微斗数部分计算无法完整落盘。
- 需要补足基础五行气质或基础性格方向。

八字辅助输出：

- `basicTemperamentHint`
- `elementBalanceHint`
- `fallbackVisualTone`
- `fallbackHomeStyleHint`
- `fallbackPetMatchHint`

八字输出不能覆盖紫微斗数主结果。八字只补全信息缺口，不作为主算法。

## 8. VisualDNA 不等于最终美术

VisualDNA 只是生成方向。

最终表现需要经过：

```txt
VisualDNA
↓
SpriteVariant
↓
PrefabVariant
↓
SceneLayout
```
