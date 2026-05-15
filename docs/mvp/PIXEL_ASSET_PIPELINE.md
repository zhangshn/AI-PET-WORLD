# AI-PET-WORLD 像素素材管线

## 1. MVP 素材策略

- MVP 阶段采用低保真温暖自然像素拼图风。
- 当前不找像素师全量外包。
- 如果像素师参与，只做风格锚点包。
- 正式美术 UI-09 后置。
- 当前只做 P0 最小素材包。
- 所有素材必须注册到 `world-map-asset-registry`。
- 地图生成器只能使用 assetId，不直接使用文件路径。
- AI 只负责候选草稿，不允许 AI 图直接进入正式地图。

## 2. P0 最小素材包

- `ground_grass_base_01`
- `ground_grass_base_02`
- `ground_dirt_base_01`
- `path_dirt_horizontal_01`
- `path_dirt_vertical_01`
- `path_dirt_corner_left_top_01`
- `path_dirt_corner_right_top_01`
- `path_dirt_corner_left_bottom_01`
- `path_dirt_corner_right_bottom_01`
- `edge_grass_dirt_top_01`
- `edge_grass_dirt_bottom_01`
- `edge_grass_dirt_left_01`
- `edge_grass_dirt_right_01`
- `building_temp_shelter_01`
- `building_pet_arrival_point_01`
- `building_initial_care_station_01`
- `facility_food_bowl_full_01`
- `facility_water_bowl_full_01`
- `facility_pet_bed_neat_01`
- `facility_storage_box_closed_01`
- `nature_tree_small_01`
- `nature_bush_small_01`
- `surface_grass_tuft_01`
- `surface_stone_small_01`
- `surface_flower_patch_01`
- `surface_fallen_leaf_01`
- `butler_body_standard_01`
- `pet_part_body_round_01`
- `pet_pose_skeleton_idle_front_01`

## 3. 注册规则

素材注册表必须提供稳定 camelCase assetId，真实文件可以保留 snake_case 文件名。

示例：

```txt
buildingTempShelter01 -> building_temp_shelter_01.png
facilityFoodBowlFull01 -> facility_food_bowl_full_01.png
```

地图、生成器、placement engine 只能传递 assetId。Renderer 才能根据 assetId 读取注册表中的真实 path。

## 4. 下一轮接入方向

下一轮 UI-06 应把 `/world/page.tsx` 从静态坐标显示改为：

```txt
HomeMapState
↓
placements
↓
Renderer
↓
像素世界
```

这样地图能由世界生成层驱动，而不是由页面手写坐标驱动。
