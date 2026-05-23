> Status: must follow V2.0 FormalVisualModel First. Assets and UI may express world facts, but must not generate world facts.

# AI-PET-WORLD 视觉生成管线 v0.1

## 1. 总链路

```txt
真实出生信息
↓
紫微斗数主算法
↓
出生时间缺失时，八字辅助补全
↓
DestinyProfile
↓
ButlerSoulProfile
↓
VisualDNA
↓
SpriteVariant
↓
PrefabVariant
↓
SceneLayout
↓
Pixel World
```

## 2. 各层职责

### ZiweiCore

负责完整出生时间下的主命盘计算，是第一核心。

### BaziFallback

只在出生时间缺失或不确定时启用，负责辅助补全基础人格倾向和基础视觉方向。

### DestinyProfile

负责解释用户生命信息和当前阶段。

### ButlerSoulProfile

负责生成管家人格、管理风格、建设风格。

### VisualDNA

负责把紫微斗数结果翻译成视觉方向。

### SpriteVariant

负责选择管家、宠物、树、房屋等像素外观变体。

### PrefabVariant

负责形成可被世界使用的组合对象，如临时住所、基础小屋、照护角、宠物、管家、树、领养中心。

### SceneLayout

负责把 Prefab 按世界资源、空间、时间和管家建设意图摆放成家园。

## 3. Primitive / Sprite / Prefab / Scene 关系

- Primitive 是语义零件。
- Sprite 是可识别像素外观。
- Prefab 是世界可用对象。
- Scene 是世界阶段组合。
- 世界场景不应该直接用 `PetEye`、`WallPanel`、`TreeTrunk` 这种 Primitive 拼接。
- 世界场景应该优先使用 Prefab。

## 4. 家园阶段管线

- `HOME-00` 空地：只有基础地表和少量自然资源。
- `HOME-01` 照护点：食物碗、水碗、观察点、欢迎垫。
- `HOME-02` 临时住所：简单遮蔽、小棚、临时墙体。
- `HOME-03` 基础小屋：墙、门、窗、屋顶。
- `HOME-04` 稳定家园：路径、围栏、储物、宠物床、花园。
- `HOME-05` 风格化家园：由紫微管家人格、资源状态、宠物需求共同影响。

## 5. 领养中心管线

MVP 可有临时领养中心或领养抵达点。

未来小镇 / 市区有更大的领养中心。

领养中心不是旧的出生装置，也不存在旧的出生装置业务逻辑。
