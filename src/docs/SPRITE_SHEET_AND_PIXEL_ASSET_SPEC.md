# AI-PET-WORLD Sprite Sheet 与像素资源规范 v0.1

## 1. 核心定位

AI-PET-WORLD 的最终视觉不能长期依赖 CSS 硬画。

CSS 样板页只用于验证方向，真正接近成熟像素游戏质感时，必须进入 Sprite Sheet 与像素资源管线。

本规范用于锁定：

```txt
ZiweiProbabilityProfile
↓
PreferenceProfile
↓
VisualDNA
↓
SpriteVariant
↓
Sprite Sheet
↓
PrefabVariant
↓
SceneLayout
```

紫微斗数是第一核心。八字不是并列核心，只在用户没有准确出生时间时作为辅助补全。

不同玩家因为紫微斗数结构不同，应生成不同管家形象、宠物类型、颜色倾向、家园风格和场景方向。

## 2. 参考边界

可以参考成熟农场 / 生活类像素游戏的通用视觉原则，例如：

- 清晰轮廓。
- 低色数。
- 统一光源。
- 16px tile 网格。
- 角色、宠物、建筑比例稳定。
- 小尺寸可读。
- 场景像游戏地图，不像网页插画。

禁止：

- 不复制任何具体游戏素材。
- 不复刻星露谷或其他游戏资产。
- 不使用外部版权图片。
- 不把参考游戏当作素材来源。
- 不把 CSS 圆角插画当作最终像素资源。

## 3. 像素基础单位

| 项目 | 规范 |
|---|---:|
| 世界基础网格 | 16x16 px |
| 主要像素绘制单位 | 1px / 2px / 4px |
| 小型对象格 | 16x16 px |
| 中型对象格 | 32x32 px |
| 角色基础高度 | 48px |
| 建筑基础宽度 | 80px / 96px |
| 场景摆放网格 | 16px 对齐 |
| 资源导出格式 | PNG 透明背景 |
| 插值方式 | nearest-neighbor / pixelated |

所有世界对象必须可以吸附到 16px 网格。

## 4. 色彩规范

### 4.1 通用色彩原则

- 每个 sprite 的主色数量控制在 4～8 个。
- 单个对象最多使用 1 个主色、1～2 个阴影色、1 个高光色、1 个轮廓色。
- 所有对象默认左上方受光，右下方阴影。
- 轮廓色必须深于主体色，用于提高小尺寸可读性。
- 不使用大面积半透明渐变。
- 不使用网页柔光风格作为最终素材。

### 4.2 VisualDNA 色调映射

| VisualColorTone | 中文 | 视觉方向 |
|---|---|---|
| metal_clear | 金属清晰调 | 灰绿、米灰、低饱和、结构清楚 |
| earth_warm | 土色暖调 | 暖棕、米黄、柔和照护感 |
| wood_green | 木系绿色 | 深绿、木色、边界与防护感 |
| fire_bright | 火系明亮调 | 暖亮、花色、装饰感更强 |
| water_quiet | 水系安静调 | 蓝灰、低饱和、安静阴影 |
| moon_soft | 月色柔调 | 紫灰、柔和、混合适应感 |

## 5. Sprite Sheet 总目录建议

未来正式资源建议放置在：

```txt
public/assets/pixel/
├─ tiles/
│  ├─ ground.png
│  ├─ grass.png
│  ├─ path.png
│  └─ water.png
├─ nature/
│  ├─ trees.png
│  ├─ shrubs.png
│  ├─ stones.png
│  └─ flowers.png
├─ actors/
│  ├─ butlers/
│  │  ├─ structured_builder.png
│  │  ├─ warm_caretaker.png
│  │  ├─ protective_keeper.png
│  │  ├─ aesthetic_organizer.png
│  │  ├─ quiet_maintainer.png
│  │  └─ adaptive_planner.png
│  └─ pets/
│     ├─ stable_attached.png
│     ├─ soft_companion.png
│     ├─ alert_guardian.png
│     ├─ curious_playful.png
│     ├─ quiet_observer.png
│     └─ adaptive_partner.png
├─ buildings/
│  ├─ temporary_shelters.png
│  ├─ basic_houses.png
│  ├─ stable_homes.png
│  └─ adoption_centers.png
├─ facilities/
│  ├─ care_corner.png
│  ├─ bowls.png
│  ├─ beds.png
│  ├─ storage.png
│  └─ observation_points.png
└─ metadata/
   ├─ sprite-index.json
   ├─ palette-map.json
   └─ visual-variant-map.json
```

当前阶段可以先只写规范，不必立即创建图片资源。

## 6. Sprite 命名规则

所有 sprite id 必须和 VisualDNA / SpriteVariant 对齐。

命名格式：

```txt
<category>_<visual-type>_<variant>_<frame>
```

示例：

```txt
butler_structured_compact_v1_idle_0
butler_soft_round_v1_idle_0
pet_stable_attached_v1_idle_0
pet_soft_companion_v1_idle_0
shelter_straight_frame_v1_base_0
home_orderly_structured_v1_base_0
```

## 7. 管家 Sprite 规范

### 7.1 基础尺寸

| 项目 | 尺寸 |
|---|---:|
| 单帧 | 32x48 px 或 40x56 px |
| 网格占地 | 2x3 tile |
| 默认方向 | 朝下 / 正面 |
| MVP 动作 | idle |
| 后续动作 | walk_down, walk_up, walk_left, walk_right, work, observe |

### 7.2 管家必须可识别部件

- 头部。
- 身体。
- 手。
- 脚。
- 眼睛。
- 衣服主色。
- 简单工具或身份特征。

### 7.3 六类管家视觉方向

| 类型 | 中文 | 视觉方向 |
|---|---|---|
| structured_builder | 秩序建设型 | 稳定、方正、衣着整齐、工具偏建设 / 记录 |
| warm_caretaker | 温暖照护型 | 圆润、暖色、照护感、柔和姿态 |
| protective_keeper | 边界守护型 | 直立、边界感、工具偏守护 / 检查 |
| aesthetic_organizer | 审美整理型 | 轻盈、装饰感、衣服色彩更柔和明亮 |
| quiet_maintainer | 安静维护型 | 低调、暗色、少装饰、稳定姿态 |
| adaptive_planner | 适应规划型 | 混合、平衡、可根据场景切换工具 |

## 8. 宠物 Sprite 规范

### 8.1 基础尺寸

| 项目 | 尺寸 |
|---|---:|
| 单帧 | 32x32 px 或 40x40 px |
| 网格占地 | 2x2 tile |
| 默认方向 | 朝下 / 侧前方 |
| MVP 动作 | idle |
| 后续动作 | walk, rest, eat, observe, approach, avoid |

### 8.2 宠物必须可识别部件

- 身体。
- 头部。
- 耳朵。
- 尾巴。
- 眼睛。
- 鼻子。
- 腿 / 爪。
- 主色。
- 特征色或花纹。

### 8.3 六类宠物视觉方向

| 类型 | 中文 | 视觉方向 |
|---|---|---|
| stable_attached | 稳定依恋型 | 稳定、亲近、体型偏圆稳 |
| soft_companion | 柔软陪伴型 | 柔和、圆润、低攻击性 |
| alert_guardian | 警觉守护型 | 站姿更警觉、耳朵更明显、边界感强 |
| curious_playful | 好奇活泼型 | 体态更轻、更亮、尾巴或耳朵更活跃 |
| quiet_observer | 安静观察型 | 低饱和、眼神安静、动作幅度小 |
| adaptive_partner | 适应伙伴型 | 混合体态，可随场景变化 |

宠物不是随机发放，而是根据用户紫微人格倾向和当前阶段匹配。

## 9. Tile 规范

### 9.1 地面 Tile

| Tile | 尺寸 | 用途 |
|---|---:|---|
| grass_base | 16x16 | 基础草地 |
| grass_detail | 16x16 | 草地变化 |
| dirt_path | 16x16 | 泥路 |
| path_edge | 16x16 | 路径边缘 |
| shadow_tile | 16x16 | 树影 / 建筑阴影 |

### 9.2 Tile 原则

- tile 必须可重复拼接。
- tile 边缘不能出现明显断裂。
- 地面 tile 不应抢角色视觉焦点。
- 草地至少需要 3 个变化 tile，避免死板重复。

## 10. 建筑 Sprite / Prefab 规范

### 10.1 建筑阶段

| 阶段 | 中文 | 建议尺寸 | 说明 |
|---|---|---:|---|
| HOME-00 | 空地 | 无固定建筑 | 土地、草地、少量树木 |
| HOME-01 | 照护点 | 80x48 | 食物碗、水碗、宠物床、欢迎垫 |
| HOME-02 | 临时住所 | 80x64 | 简单遮蔽、支撑结构、小入口 |
| HOME-03 | 基础小屋 | 96x80 | 墙、门、窗、屋顶、地基 |
| HOME-04 | 稳定家园 | 视组合扩展 | 路径、围栏、储物、花园 |
| HOME-05 | 风格化家园 | 视 VisualDNA 扩展 | 紫微管家人格影响布局 |

### 10.2 建筑必须可识别部件

- 地基。
- 墙体。
- 屋顶。
- 门。
- 窗。
- 阴影。
- 可选装饰。

### 10.3 领养中心

MVP 可以有临时领养中心或领养抵达点。

未来小镇 / 市区会出现更大的领养中心。

领养中心不是孵化器，不存在孵化仓、胚胎、hatch、incubator、embryo。

## 11. Prefab 规范

Prefab 是世界可摆放对象，不是零件。

Primitive 是语义零件；Sprite 是外观；Prefab 是世界对象；Scene 是阶段场景。

| Prefab | 来源 | 用途 |
|---|---|---|
| ButlerPrefab | ButlerSprite | 管家世界对象 |
| PetPrefab | PetSprite | 宠物世界对象 |
| CareCornerPrefab | care sprites | 照护角对象 |
| TemporaryShelterPrefab | shelter sprite | 临时住所 |
| BasicHousePrefab | house sprite | 基础小屋 |
| GardenPrefab | tile + flower sprites | 花园对象 |
| TemporaryAdoptionCenterPrefab | adoption center sprite | 临时领养中心 |

Scene 不应该直接用 Primitive 色块拼接，应该优先使用 Prefab。

## 12. Scene 规范

### 12.1 场景类型

| Scene | 中文 | 内容 |
|---|---|---|
| InitialHomeScene | 初始家园 | 草地、少量树、抵达点、管家、宠物 |
| CarePointScene | 照护点场景 | 食物碗、水碗、宠物床、观察点 |
| TemporaryShelterScene | 临时住所场景 | 简单遮蔽、小屋雏形、路径 |
| BasicHomeScene | 基础小屋场景 | 完整小屋、门窗、路径、照护区 |
| AdoptionArrivalScene | 领养抵达场景 | 领养中心 / 抵达点 / 欢迎垫 |

### 12.2 场景摆放原则

- 所有对象吸附 16px 网格。
- 角色和宠物必须位于可读区域。
- 建筑不能压住角色。
- 树冠和屋顶可以产生遮挡层，但不能挡住主角。
- 路径应该连接重要对象。
- 家园风格由 PreferenceProfile / VisualDNA 决定。

## 13. 六类紫微视觉方向到 Sprite Sheet 的映射

| 紫微视觉类型 | 管家 | 宠物 | 家园 | 优先对象 |
|---|---|---|---|---|
| structured_builder | 稳定紧凑 | 稳定依恋 | 秩序结构 | 地基、储物、直线路径 |
| warm_caretaker | 柔和圆润 | 柔软陪伴 | 温暖照护 | 宠物床、食物碗、水碗 |
| protective_keeper | 守护直立 | 警觉守护 | 边界防护 | 围栏、观察点、安全角落 |
| aesthetic_organizer | 轻盈审美 | 好奇活泼 | 花园审美 | 花、窗光、装饰路径 |
| quiet_maintainer | 安静简洁 | 安静观察 | 安静极简 | 树荫、低调住所、少装饰 |
| adaptive_planner | 平衡适应 | 适应伙伴 | 适应混合 | 情境变化、混合布局 |

## 14. 后续执行顺序

建议后续按这个顺序做：

1. 先建立 Sprite Sheet metadata 类型。
2. 再做 placeholder sprite index，不直接画最终图。
3. 再把 VisualDNA 映射到 sprite id。
4. 再做像素资源预览页。
5. 最后才接真实图片资源或 Pixi。

不要再继续用 CSS 当最终美术。

CSS 只用于：

- 方向验证。
- 页面布局。
- 临时占位。
- 开发调试。

真正像素游戏质感必须依赖 Sprite Sheet。
