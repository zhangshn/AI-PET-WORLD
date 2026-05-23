> Status: must follow V2.0 FormalVisualModel First. Assets and UI may express world facts, but must not generate world facts.

# AI-PET-WORLD 像素美术模块规则 v0.1

## 1. 最高原则

`pixel-ui` 不是最终色块系统。当前已有小组件不是最终画面，而是用于定义世界语义的 Primitive。

AI-PET-WORLD 的像素世界应采用三层到四层的生成关系：

- Primitive 负责语义定义。
- Pixel Sprite 负责可识别像素外观。
- Prefab 负责把 Sprite 组合成世界对象。
- Scene 负责把 Prefab 摆成家园、住所、宠物生活区、领养中心等场景。

## 2. 三层结构

### Primitive / 原子定义层

示例：

- `GrassTile`
- `TreeTrunk`
- `WallPanel`
- `RoofPiece`
- `PetEye`
- `PetTail`
- `ButlerToolHammer`

作用：

- 让系统知道有哪些语义部件。
- 未来给资源系统、建设系统和 AI 管家引用。
- 不直接代表最终视觉。

### Pixel Sprite / 像素外观层

示例：

- `PixelGrassSprite`
- `PixelTreeSprite`
- `PixelPetSprite`
- `PixelButlerSprite`
- `PixelTemporaryShelterSprite`

作用：

- 用 CSS 像素矩阵、CSS grid 或 box-shadow 画出可识别的像素对象。
- 验证对象轮廓、比例和色彩语义。
- 作为正式素材替换前的低保真视觉方向。

### Prefab / 世界组合对象层

示例：

- `LowFiTreePrefab`
- `LowFiPetPrefab`
- `LowFiButlerPrefab`
- `LowFiTemporaryShelterPrefab`
- `LowFiCareCornerPrefab`
- `LowFiAdoptionCenterPrefab`

作用：

- 把像素对象和业务语义组合成可放入世界的对象。
- 作为未来场景摆放、管家建设、维护和互动的优先单位。

## 3. 世界组合规则

世界场景不能直接由 `PetEye`、`WallPanel`、`TreeTrunk` 这种 Primitive 零件拼成最终画面。

世界场景应该摆放 Prefab：

```txt
Primitive
↓
Pixel Sprite
↓
Prefab
↓
Scene
```

Primitive 只是定义和调试，Pixel Sprite 是视觉表达，Prefab 是管家未来可以建设、维护、放置、使用的对象。

## 4. 网格规则

- 世界网格单位：16px。
- 像素美术基础像素：4px。
- 所有 Prefab 必须吸附 16px 网格。
- Prefab 占地必须明确。

建议占地：

- `LowFiTreePrefab`：2x3
- `LowFiPetPrefab`：2x2
- `LowFiButlerPrefab`：2x3
- `LowFiCareCornerPrefab`：4x2
- `LowFiTemporaryShelterPrefab`：4x3
- `LowFiBasicHousePrefab`：5x4
- `LowFiAdoptionCenterPrefab`：6x4
- `LowFiArrivalPointPrefab`：2x2

## 5. 家园建设阶段

- `HOME-00` 空地：基础地表和少量自然资源。
- `HOME-01` 照护点：食物碗、水碗、观察点、欢迎垫。
- `HOME-02` 临时住所：简单遮蔽、小棚、临时墙体。
- `HOME-03` 基础小屋：墙、门、窗、屋顶。
- `HOME-04` 稳定家园：路径、围栏、储物、宠物床、花园。
- `HOME-05` 风格化家园：由管家人格、紫微斗数视觉 DNA、资源状态和宠物需求共同影响。

当前测试页里的小房子不能叫最终房屋，只能算临时住所或基础住所原型。

## 6. 色彩语义

- 草地：绿色系。
- 路径 / 泥地：棕色系。
- 木头：暖棕。
- 墙体：米色 / 灰褐。
- 屋顶：深棕 / 暖棕。
- 宠物：主色 + 少量特征色。
- 管家：衣服色、肤色、头发色要区分。
- 可交互设施：稍亮。
- 逻辑点位：开发模式蓝灰色。
- 光效：浅黄色。
- 阴影：半透明深灰。

## 7. 旧组件处理

已有 `GroundTile`、`GrassTile`、`PetEye`、`WallPanel` 等组件不删除。

它们继续作为 Primitive / 原子定义组件保留，但 `/pixel-layer-test` 中必须明确标注它们不是最终美术。
