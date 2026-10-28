# AI-PET-WORLD 世界视觉数据字典

Printed: 2026-07-08 14:26:44 +08:00
Dictionary Version: mvp-natural-home-v0.1
Status: draft
GeneratedAt: 2026-07-08T06:30:46.781Z

## 1. 文档目录

| 序号 | 目录 | 职责 | 条目数 |
| --- | --- | --- | --- |
| 1 | baseline/ | 类地球世界基准、自然物理逻辑、第一版范围。 | 1 |
| 2 | world-ontology/ | 世界实体、本体、sourceFactId 绑定与禁止凭空创造规则。 | 2 |
| 3 | spatial-grid/ | 坐标、层级、可走、碰撞、交互、物体脚印和状态层；当前玩家/交互仅保留架构。 | 2 |
| 4 | map-grammar/ | 完整地图语法：入口、主路、中心、水岸、边界、开放区。 | 2 |
| 5 | terrain/ | 地形视觉定义：草、水、泥路、岸线、泥地、森林边缘。 | 7 |
| 6 | objects/ | 地图物体定义：树、石头、灌木、花、草细节、碎石、芦苇。 | 8 |
| 7 | ecology/ | 单一地图生态：湿度、生长、植被密度、水岸生态、路径磨损。 | 2 |
| 8 | gameplay/ | 玩家/交互架构保留；当前阶段不作为训练和验收目标。 | 1 |
| 9 | runtime-state/ | 活地图 tick、状态变化、RuntimeFrame 和审核记录绑定；当前不要求多 tick 变化。 | 2 |
| 10 | map-structure/ | 入口、中心、路径、边界等单一地图视觉结构。 | 8 |
| 11 | visual-style/ | 镜头、光照、颜色、材质密度、边缘、物体落地。 | 6 |
| 12 | drawing-method/ | AI 作画流程：意图锁定、语义清单、空间草图、明暗、材质、落地、审核。 | 1 |
| 13 | art-direction/ | 专业游戏美术方向：玩家第一眼、统一风格、禁止训练预览感。 | 1 |
| 14 | material-recipe/ | 单一地图材质画法：草、水、泥路、岸线、石头、植被细节。 | 2 |
| 15 | composition-recipe/ | 单一地图构图方法：阅读顺序、主次层级、开放空间、细节节奏。 | 2 |
| 16 | render-layer-recipe/ | 渲染层级：地表、水、路径、岸线、物体脚印、物体、阴影、细节。 | 1 |
| 17 | quality-rubric/ | 专业质量评分：游戏感、地图语法、材质、统一性、落地、单图完成度。 | 1 |
| 18 | composition/ | 层级顺序、地图可读性和专业游戏画面标准。 | 3 |
| 19 | director/ | 导演如何将世界事实、失败码、规则转成单一地图生成任务。 | 2 |
| 20 | generation-task/ | 小模型完整单一地图 RuntimeFrame 推理任务包结构。 | 2 |
| 21 | review/ | 单一地图通过标准、失败码和人工/机器审核规则。 | 3 |
| 22 | training/ | 正负样本标签、自动存储和反馈闭环。 | 3 |
| 23 | schema/ | 字典条目和审核记录的数据结构。 | 2 |
| 24 | database/ | 未来数据库表、版本、同步、迁移和存储规划。 | 2 |
| 25 | versions/ | 第一版自然家园地图边界、当前单一地图范围和晋级规则。 | 2 |

## 2. 总览

| 项目 | 数量 |
| --- | --- |
| 文档数 | 71 |
| 字典条目 | 68 |
| 分类数 | 25 |
| 注册失败码 | 281 |
| Hard Failure 总数 | 260 |
| 未注册 Hard Failure | 0 |
| 训练标签 | 16 |
| 缺失分类 | 0 |

## 3. 当前主动范围

| 范围 | 状态 | 说明 |
| --- | --- | --- |
| 完整单一地图视觉 | Active | 当前只训练和验收这一块。 |
| 入口/主路/中心/水岸/自然边界 | Active | 必须在同一张完整地图里读出来。 |
| 草/水/泥路/岸线/树石灌木等视觉 | Active | 当前核心训练目标。 |
| 生态/材质/构图/单图审核字段 | Active | 已生成文档并接入 generation-task / director。 |
| 玩家角色 | Reserved | 架构保留，当前不画、不训练、不审核。 |
| 玩家移动机制 | Reserved | 架构保留，当前不作为通过/失败依据。 |
| 点击/采集/建造/检查交互 | Reserved | 架构保留，当前不进入训练目标。 |
| 多 tick 动态变化 | Reserved | 架构保留，当前不要求动态变化。 |

## 4. 第一版核心标准

```txt
完整单一地图 RuntimeFrame 视觉
+ 类地球自然家园
+ 1024x768 首版目标
+ 俯视或轻微 3/4 的 2D 手绘游戏地图
+ 入口、主路、中心、水岸、自然边界必须可读
+ 当前不画玩家角色，不训练点击/采集/建造/检查交互，不要求多 tick 动态变化
+ generation-task 必须包含 singleMapScope、singleMapEcologyFields、singleMapMaterialFields、singleMapCompositionFields、singleMapAcceptance
+ director 必须包含 singleMapScopePlan、singleMapEcologyPlan、singleMapMaterialPlan、singleMapCompositionPlan、singleMapAcceptancePlan
+ 审核必须使用单一地图视觉验收标准，不得使用玩家/交互/动态门槛
+ 所有 hard failure 必须登记为正式 failure code
+ 小模型每次推理必须自动存储任务包、图片、模型版本、审核、失败码、下一轮修复目标
```

## 5. 失败码清账结果

| 项目 | 结果 |
| --- | --- |
| 注册失败码 | 281 |
| Hard Failure 总数 | 260 |
| 未注册 Hard Failure | 0 |
| 清账状态 | 完成 |

## 6. 分类详细内容

### baseline/

职责：类地球世界基准、自然物理逻辑、第一版范围。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| baseline/earth | world baseline | v0.1 | docs/world-visual-data-dictionary/baseline/earth.md | Type: world baseline Version: v0.1 The first AI-PET-WORLD natural home uses Earth-like natural logic. This does |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| baseline/earth | floating_object | Object appears pasted without ground contact. |
| baseline/earth | mixed_world_physics | Some elements behave like icons, others like 3D objects, breaking world consistency. |
| baseline/earth | non_earth_visual_logic | Water, soil, plant or stone no longer reads as Earth-like natural material. |

### world-ontology/

职责：世界实体、本体、sourceFactId 绑定与禁止凭空创造规则。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| world-ontology/entity-taxonomy | world-ontology | v0.2 | docs/world-visual-data-dictionary/world-ontology/entity-taxonomy.md | Type: world-ontology Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| world-ontology/world-entity-record-schema | world-ontology | v0.2 | docs/world-visual-data-dictionary/world-ontology/world-entity-record-schema.md | Type: world-ontology Version: v0.2 Updated: 2026-07-08 13:53:29 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| world-ontology/entity-taxonomy | invented_major_entity | The image contains major buildings, roads, characters, objects, or events not present in world facts. |
| world-ontology/entity-taxonomy | missing_required_entity | A required first-version structure or terrain entity is absent. |
| world-ontology/entity-taxonomy | unbound_visible_entity | A visible major entity cannot be traced to world facts or version scope. |
| world-ontology/entity-taxonomy | entity_scope_mismatch | The image shows a feature outside the current dictionary version boundary. |
| world-ontology/world-entity-record-schema | entity_record_schema_missing_field | World entity record lacks required schema fields. |
| world-ontology/world-entity-record-schema | runtime_entity_missing_source_fact | Runtime-only entity has no sourceFactId. |
| world-ontology/world-entity-record-schema | visible_entity_missing_visual_entry | Visible entity has no allowed visual dictionary entry. |
| world-ontology/world-entity-record-schema | visible_entity_missing_placement_domain | Visible entity has no placement domain. |
| world-ontology/world-entity-record-schema | forbidden_entity_in_task | Forbidden entity appears in generation task or candidate frame. |

### spatial-grid/

职责：坐标、层级、可走、碰撞、交互、物体脚印和状态层；当前玩家/交互仅保留架构。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| spatial-grid/grid-and-layer-contract | spatial-grid | v0.2 | docs/world-visual-data-dictionary/spatial-grid/grid-and-layer-contract.md | Type: spatial-grid Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| spatial-grid/layer-record-schema | spatial-grid | v0.2 | docs/world-visual-data-dictionary/spatial-grid/layer-record-schema.md | Type: spatial-grid Version: v0.2 Updated: 2026-07-08 13:11:42 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| spatial-grid/grid-and-layer-contract | visual_logic_mismatch | Visual walkability or collision does not match runtime layer meaning. |
| spatial-grid/grid-and-layer-contract | unreadable_walkable_area | Player cannot tell where movement is allowed. |
| spatial-grid/grid-and-layer-contract | unreadable_collision_area | Blocked regions are not visually justified. |
| spatial-grid/grid-and-layer-contract | broken_route_continuity | The path is visually interrupted or disconnected. |
| spatial-grid/grid-and-layer-contract | object_footprint_missing | Objects lack clear contact footprint in spatial layer. |
| spatial-grid/layer-record-schema | layer_record_schema_missing_field | Spatial layer record lacks required schema fields. |
| spatial-grid/layer-record-schema | layer_geometry_missing | Spatial layer record has no usable geometry. |
| spatial-grid/layer-record-schema | layer_visual_cue_missing | Spatial layer has no visible cue binding. |
| spatial-grid/layer-record-schema | collision_walkable_overlap_unresolved | Walkable and collision regions overlap without a rule. |
| spatial-grid/layer-record-schema | object_footprint_geometry_mismatch | Object footprint geometry does not match visible object contact. |

### map-grammar/

职责：完整地图语法：入口、主路、中心、水岸、边界、开放区。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| map-grammar/complete-map-grammar | map-grammar | v0.2 | docs/world-visual-data-dictionary/map-grammar/complete-map-grammar.md | Type: map-grammar Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| map-grammar/map-part-schema | map-grammar | v0.2 | docs/world-visual-data-dictionary/map-grammar/map-part-schema.md | Type: map-grammar Version: v0.2 Updated: 2026-07-08 13:11:42 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| map-grammar/complete-map-grammar | missing_complete_map_part | One or more required map parts are absent. |
| map-grammar/complete-map-grammar | route_hierarchy_missing | Main and branch routes cannot be distinguished. |
| map-grammar/complete-map-grammar | center_swallowed_by_texture | Home center exists but is unreadable because of texture or clutter. |
| map-grammar/complete-map-grammar | boundary_hard_clip | Map edge reads as cropped rectangle rather than natural boundary. |
| map-grammar/complete-map-grammar | random_asset_scatter | Objects do not support route, center, water edge, or boundary grammar. |
| map-grammar/map-part-schema | map_part_schema_missing_field | A map grammar part lacks required schema fields. |
| map-grammar/map-part-schema | map_part_connection_missing | A required connection between map parts is absent. |
| map-grammar/map-part-schema | map_part_role_conflict | Walkable, collision, interaction, or visual role conflicts. |
| map-grammar/map-part-schema | map_part_unreadable | A required map part exists structurally but cannot be read visually. |

### terrain/

职责：地形视觉定义：草、水、泥路、岸线、泥地、森林边缘。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| terrain/dirt-path | terrain | v0.1 | docs/world-visual-data-dictionary/terrain/dirt-path.md | Type: terrain World meaning: walkable earth path connecting important areas Version: v0.1 |
| terrain/forest-edge | terrain boundary | v0.1 | docs/world-visual-data-dictionary/terrain/forest-edge.md | Type: terrain boundary World meaning: natural map boundary and dense vegetation edge Version: v0.1 |
| terrain/grass | terrain | v0.1 | docs/world-visual-data-dictionary/terrain/grass.md | Type: terrain World meaning: ordinary walkable natural grassland Version: v0.1 |
| terrain/mud-patch | terrain detail | v0.1 | docs/world-visual-data-dictionary/terrain/mud-patch.md | Type: terrain detail World meaning: damp exposed soil Version: v0.1 |
| terrain/shoreline | terrain transition | v0.1 | docs/world-visual-data-dictionary/terrain/shoreline.md | Type: terrain transition World meaning: natural boundary between land and water Version: v0.1 |
| terrain/tall-grass | terrain | v0.1 | docs/world-visual-data-dictionary/terrain/tall-grass.md | Type: terrain World meaning: denser grass, edge vegetation, soft obstacle hint Version: v0.1 |
| terrain/water | terrain | v0.1 | docs/world-visual-data-dictionary/terrain/water.md | Type: terrain World meaning: natural water body Version: v0.1 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| terrain/dirt-path | color_band_path | Path looks like a pasted color band. |
| terrain/dirt-path | brick_repetition | Path reads as repeated bricks/tiles instead of natural soil. |
| terrain/dirt-path | hard_cut_edge | Edge is perfectly sharp or geometric. |
| terrain/dirt-path | broken_route | Path visually fails to connect entrance, center or branch target. |
| terrain/forest-edge | tree_wall | Boundary becomes a repeated tree wall. |
| terrain/forest-edge | noisy_dark_edge | Edge is a dark noise band. |
| terrain/forest-edge | center_invasion | Boundary elements invade and hide the playable center. |
| terrain/grass | green_noise_field | Grass reads as random noise or dirty texture. |
| terrain/grass | muddy_blur | Grass becomes an unclear brown-green smear. |
| terrain/grass | repeated_tile_grid | Repeated 64px/128px block pattern is visible. |
| terrain/grass | overgrown_path | Grass destroys path readability. |
| terrain/mud-patch | muddy_map | Mud spreads across the full frame and makes grass dirty. |
| terrain/mud-patch | stain_noise | Mud looks like random stains. |
| terrain/mud-patch | gameplay_confusion | Mud hides path or water boundary. |
| terrain/shoreline | hard_cut_shore | Shoreline is a sharp mask edge. |
| terrain/shoreline | pasted_wall_shore | Shoreline looks like a vertical pasted wall. |
| terrain/shoreline | overwide_shore | Shoreline covers too much land or water. |
| terrain/shoreline | disconnected_shore | Shoreline does not follow the water boundary. |
| terrain/tall-grass | full_frame_overgrowth | Tall grass covers the map and destroys readability. |
| terrain/tall-grass | noisy_clumps | Clumps become random dark stains. |
| terrain/tall-grass | path_contamination | Tall grass hides or visually breaks the main path. |
| terrain/water | electric_blue_noise | Water is neon, noisy or visually synthetic. |
| terrain/water | broken_water_surface | Water breaks into unrelated blobs. |
| terrain/water | vertical_wall_water | Water edge looks like a pasted vertical wall or cliff strip. |
| terrain/water | unreadable_depth | No shallow/deep relation can be read. |

### objects/

职责：地图物体定义：树、石头、灌木、花、草细节、碎石、芦苇。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| objects/berry-bush | object/resource | v0.1 | docs/world-visual-data-dictionary/objects/berry-bush.md | Type: object/resource World meaning: small resource plant Version: v0.1 |
| objects/flower | object/detail | v0.1 | docs/world-visual-data-dictionary/objects/flower.md | Type: object/detail World meaning: small natural decoration Version: v0.1 |
| objects/grass-detail | object/detail | v0.1 | docs/world-visual-data-dictionary/objects/grass-detail.md | Type: object/detail World meaning: small non-interactive surface detail Version: v0.1 |
| objects/pebble | object/detail | v0.1 | docs/world-visual-data-dictionary/objects/pebble.md | Type: object/detail World meaning: small stone detail Version: v0.1 |
| objects/reed | object/detail | v0.1 | docs/world-visual-data-dictionary/objects/reed.md | Type: object/detail World meaning: shoreline vegetation Version: v0.1 |
| objects/rock | object | v0.1 | docs/world-visual-data-dictionary/objects/rock.md | Type: object World meaning: stone obstacle or decoration Version: v0.1 |
| objects/shrub | object | v0.1 | docs/world-visual-data-dictionary/objects/shrub.md | Type: object World meaning: low vegetation, soft boundary, decoration Version: v0.1 |
| objects/tree | object | v0.1 | docs/world-visual-data-dictionary/objects/tree.md | Type: object World meaning: plant, obstacle, boundary, ecology signal Version: v0.1 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| objects/berry-bush | indistinct_resource | Cannot distinguish from random grass noise. |
| objects/berry-bush | floating_resource | No ground contact. |
| objects/berry-bush | excessive_bright_berries | Berry accents become noisy bright pixels. |
| objects/flower | pale_patch_flower | Flower cluster becomes large pale flat patch. |
| objects/flower | path_pollution | Flowers hide or dirty the path. |
| objects/flower | overbright_noise | Flowers create noisy bright speckles. |
| objects/grass-detail | detail_noise | Detail becomes random surface noise. |
| objects/grass-detail | repeated_stamp | Same detail repeats visibly. |
| objects/grass-detail | structure_masking | Detail hides path, center or water boundary. |
| objects/pebble | pebble_noise | Pebbles become salt-and-pepper noise. |
| objects/pebble | false_obstacle | Pebbles look like major blockers. |
| objects/pebble | repeated_dot_pattern | Pebbles form a visible grid or repeated dot stamp. |
| objects/reed | inland_reed | Reeds appear far from water without reason. |
| objects/reed | reed_wall | Reeds form a wall or block the water boundary. |
| objects/reed | noisy_stripes | Reeds become dense line noise. |
| objects/rock | black_noise_rock | Rock reads as dark noise. |
| objects/rock | sticker_rock | No shadow or terrain contact. |
| objects/rock | scale_mismatch | Rock scale conflicts with tree/path. |
| objects/shrub | green_blob | Shrub is only an unclear green blob. |
| objects/shrub | floating_shrub | No base contact. |
| objects/shrub | style_mismatch | Shrub does not match trees/grass style. |
| objects/tree | floating_tree | Tree appears to hover. |
| objects/tree | sticker_tree | Tree looks pasted from another image/style. |
| objects/tree | perspective_mismatch | Tree camera conflicts with map camera. |
| objects/tree | scale_mismatch | Tree size breaks world scale. |

### ecology/

职责：单一地图生态：湿度、生长、植被密度、水岸生态、路径磨损。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| ecology/ecology-state-rules | ecology | v0.2 | docs/world-visual-data-dictionary/ecology/ecology-state-rules.md | Type: ecology Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| ecology/single-map-ecology-fields | ecology | v0.2 | docs/world-visual-data-dictionary/ecology/single-map-ecology-fields.md | Type: ecology Version: v0.2 Updated: 2026-07-08 14:03:25 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| ecology/ecology-state-rules | ecology_random_noise | Natural details look randomly sprayed rather than ecologically related. |
| ecology/ecology-state-rules | vegetation_density_overload | Vegetation density hides map structure or route readability. |
| ecology/ecology-state-rules | water_ecology_mismatch | Water edge lacks wetland, shore, or transition logic. |
| ecology/ecology-state-rules | path_wear_missing | Path does not affect surrounding grass or ground. |
| ecology/ecology-state-rules | biome_style_mismatch | Plants, terrain, and color imply conflicting biomes. |
| ecology/single-map-ecology-fields | single_map_ecology_fields_missing | Single-map generation task lacks required ecology fields. |
| ecology/single-map-ecology-fields | moisture_map_unreadable | Dry/wet/shoreline/open grass zones cannot be read. |
| ecology/single-map-ecology-fields | grass_growth_ignores_path | Grass density does not respond to the path. |
| ecology/single-map-ecology-fields | shoreline_ecology_missing | Water edge lacks wet grass, reeds or natural transition cues. |
| ecology/single-map-ecology-fields | boundary_vegetation_wall | Boundary vegetation becomes a flat wall instead of natural framing. |

### gameplay/

职责：玩家/交互架构保留；当前阶段不作为训练和验收目标。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| gameplay/playability-contract | gameplay | v0.2 | docs/world-visual-data-dictionary/gameplay/playability-contract.md | Type: gameplay Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| gameplay/playability-contract | no_playable_read | The image looks decorative but not playable. |
| gameplay/playability-contract | movement_affordance_missing | Player cannot infer where movement is possible. |
| gameplay/playability-contract | collision_affordance_missing | Blocked areas are not visually explained. |
| gameplay/playability-contract | interaction_cue_noise | Too many decorative details compete with future interaction points. |
| gameplay/playability-contract | player_scale_conflict | Path, objects, and open areas imply incompatible player scale. |

### runtime-state/

职责：活地图 tick、状态变化、RuntimeFrame 和审核记录绑定；当前不要求多 tick 变化。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| runtime-state/live-map-state | runtime-state | v0.2 | docs/world-visual-data-dictionary/runtime-state/live-map-state.md | Type: runtime-state Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| runtime-state/runtime-frame-state-binding-schema | runtime-state | v0.2 | docs/world-visual-data-dictionary/runtime-state/runtime-frame-state-binding-schema.md | Type: runtime-state Version: v0.2 Updated: 2026-07-08 13:53:29 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| runtime-state/live-map-state | tick_unbound_frame | Frame is not bound to worldId and tick. |
| runtime-state/live-map-state | state_diff_untraceable | Visual change cannot be traced to runtime state. |
| runtime-state/live-map-state | unstable_world_identity | Same world changes style or layout without a state reason. |
| runtime-state/live-map-state | visual_repair_rewrites_facts | Visual fix changes stored world facts instead of regenerating expression. |
| runtime-state/live-map-state | missing_review_link | RuntimeFrame lacks link to generation and review records. |
| runtime-state/runtime-frame-state-binding-schema | runtime_binding_schema_missing_field | Runtime frame state binding lacks required fields. |
| runtime-state/runtime-frame-state-binding-schema | runtime_binding_missing_generation_trace | Binding lacks director or generation task id. |
| runtime-state/runtime-frame-state-binding-schema | runtime_binding_missing_asset_trace | Binding lacks generated asset id or image hash link. |
| runtime-state/runtime-frame-state-binding-schema | runtime_binding_missing_review_trace | Binding lacks review record id. |
| runtime-state/runtime-frame-state-binding-schema | runtime_binding_missing_state_trace | Binding lacks sourceFactIds or stateDiffIds. |
| runtime-state/runtime-frame-state-binding-schema | runtime_binding_world_gate_bypass | canEnterWorld is true without required review gates. |

### map-structure/

职责：入口、中心、路径、边界等单一地图视觉结构。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| map-structure/branch-path | map structure | v0.1 | docs/world-visual-data-dictionary/map-structure/branch-path.md | Type: map structure World meaning: secondary route Version: v0.1 |
| map-structure/collision-area | map structure | v0.1 | docs/world-visual-data-dictionary/map-structure/collision-area.md | Type: map structure World meaning: non-walkable or blocking area Version: v0.1 |
| map-structure/entrance | map structure | v0.1 | docs/world-visual-data-dictionary/map-structure/entrance.md | Type: map structure World meaning: player entry point Version: v0.1 |
| map-structure/home-center | map structure | v0.1 | docs/world-visual-data-dictionary/map-structure/home-center.md | Type: map structure World meaning: natural home center, visual organization point Version: v0.1 |
| map-structure/main-path | map structure | v0.1 | docs/world-visual-data-dictionary/map-structure/main-path.md | Type: map structure World meaning: primary walkable route Version: v0.1 |
| map-structure/natural-boundary | map structure | v0.1 | docs/world-visual-data-dictionary/map-structure/natural-boundary.md | Type: map structure World meaning: natural edge of playable map Version: v0.1 |
| map-structure/walkable-area | map structure | v0.1 | docs/world-visual-data-dictionary/map-structure/walkable-area.md | Type: map structure World meaning: area where player can move Version: v0.1 |
| map-structure/water-edge-zone | map structure | v0.1 | docs/world-visual-data-dictionary/map-structure/water-edge-zone.md | Type: map structure World meaning: playable/readable area around water boundary Version: v0.1 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| map-structure/branch-path | meaningless_branch | Branch path goes nowhere. |
| map-structure/branch-path | branch_dominates_map | Secondary path steals focus from main structure. |
| map-structure/collision-area | invisible_collision | Movement is blocked with no visible reason. |
| map-structure/collision-area | visible_blocker_no_collision | Object looks blocking but data allows walking through it. |
| map-structure/entrance | hidden_entrance | Player cannot tell where entry starts. |
| map-structure/entrance | disconnected_entrance | Entrance does not connect to main path. |
| map-structure/home-center | missing_center | No readable center exists. |
| map-structure/home-center | center_as_noise | Center is buried under texture. |
| map-structure/home-center | unauthorized_building | Center becomes a building without world fact. |
| map-structure/main-path | unreadable_main_path | Main route cannot be recognized. |
| map-structure/main-path | obstructed_main_path | Path appears blocked by tree, rock, water or noise. |
| map-structure/main-path | arbitrary_path | Path exists visually but has no structure purpose. |
| map-structure/natural-boundary | hard_boundary_wall | Boundary looks artificial. |
| map-structure/natural-boundary | boundary_noise | Boundary is unreadable dark/green noise. |
| map-structure/natural-boundary | boundary_collision_mismatch | Visual boundary contradicts collision data. |
| map-structure/walkable-area | walkable_visual_blocked | Walkable area looks blocked. |
| map-structure/walkable-area | collision_visual_conflict | Visual says walkable but collision says blocked, or the reverse. |
| map-structure/water-edge-zone | water_edge_wall | Edge looks like a wall or pasted strip. |
| map-structure/water-edge-zone | water_edge_confusion | Player cannot tell land from water. |

### visual-style/

职责：镜头、光照、颜色、材质密度、边缘、物体落地。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| visual-style/camera | visual style | v0.1 | docs/world-visual-data-dictionary/visual-style/camera.md | Type: visual style Version: v0.1 The first map must use one camera language. |
| visual-style/color | visual style | v0.1 | docs/world-visual-data-dictionary/visual-style/color.md | Type: visual style Version: v0.1 Colors should be natural, readable and game-like. |
| visual-style/edge-treatment | visual style | v0.1 | docs/world-visual-data-dictionary/visual-style/edge-treatment.md | Type: visual style Version: v0.1 Edges must explain natural transitions. |
| visual-style/light | visual style | v0.1 | docs/world-visual-data-dictionary/visual-style/light.md | Type: visual style Version: v0.1 Lighting should make the world unified and readable. |
| visual-style/material-density | visual style | v0.1 | docs/world-visual-data-dictionary/visual-style/material-density.md | Type: visual style Version: v0.1 Material detail must be layered and controlled. |
| visual-style/object-grounding | visual style | v0.1 | docs/world-visual-data-dictionary/visual-style/object-grounding.md | Type: visual style Version: v0.1 Object grounding is mandatory. Any object that feels pasted or floating fails. |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| visual-style/camera | perspective_mismatch | Elements use conflicting camera angles. |
| visual-style/camera | unreadable_map_camera | Camera makes walkable space unclear. |
| visual-style/color | neon_noise | Saturated speckle artifacts dominate. |
| visual-style/color | muddy_palette | Whole map becomes brown-green sludge. |
| visual-style/color | asset_palette_mismatch | Objects have unrelated colors/style. |
| visual-style/edge-treatment | hard_mask_edge | Terrain masks are visibly hard-cut. |
| visual-style/edge-treatment | pasted_edge | Objects or shoreline look pasted. |
| visual-style/edge-treatment | edge_blur | Edges are so blurred that structure is unreadable. |
| visual-style/light | no_contact_shadow | Objects float due to missing shadow/base. |
| visual-style/light | conflicting_light | Different objects have different light directions. |
| visual-style/light | overdark_scene | Shadows hide gameplay structure. |
| visual-style/material-density | full_frame_noise | Same high-density texture covers everything. |
| visual-style/material-density | low_detail_flatness | Large areas are flat and unfinished. |
| visual-style/material-density | repeated_material_stamp | Repeated tile or stamp is visible. |
| visual-style/object-grounding | sticker_asset | Object has no integration with ground. |
| visual-style/object-grounding | floating_asset | Object lacks contact shadow/base. |
| visual-style/object-grounding | scale_break | Object size breaks map scale. |

### drawing-method/

职责：AI 作画流程：意图锁定、语义清单、空间草图、明暗、材质、落地、审核。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| drawing-method/ai-drawing-process | drawing-method | v0.2 | docs/world-visual-data-dictionary/drawing-method/ai-drawing-process.md | Type: drawing-method Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| drawing-method/ai-drawing-process | missing_drawing_process | Generation did not store the drawing-process data. |
| drawing-method/ai-drawing-process | skipped_spatial_blockout | Image jumped into texture/detail without a readable layout blockout. |
| drawing-method/ai-drawing-process | skipped_value_grouping | Image has materials but no readable light/dark structure. |
| drawing-method/ai-drawing-process | skipped_grounding_pass | Objects and edges were not integrated into terrain. |
| drawing-method/ai-drawing-process | polish_without_structure | Image has detail but lacks professional map structure. |

### art-direction/

职责：专业游戏美术方向：玩家第一眼、统一风格、禁止训练预览感。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| art-direction/professional-game-art-direction | art-direction | v0.2 | docs/world-visual-data-dictionary/art-direction/professional-game-art-direction.md | Type: art-direction Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| art-direction/professional-game-art-direction | art_direction_missing | Frame has no stable professional game art direction. |
| art-direction/professional-game-art-direction | not_player_facing_art | Frame looks like training output or debug preview, not a player-facing map. |
| art-direction/professional-game-art-direction | style_family_mixed | Terrain, objects or water belong to conflicting art styles. |
| art-direction/professional-game-art-direction | gameplay_read_not_supported | Art direction does not support route, movement or interaction readability. |
| art-direction/professional-game-art-direction | detail_density_unprofessional | Detail density is either empty, noisy, or uncontrolled. |

### material-recipe/

职责：单一地图材质画法：草、水、泥路、岸线、石头、植被细节。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| material-recipe/natural-home-material-recipes | material-recipe | v0.2 | docs/world-visual-data-dictionary/material-recipe/natural-home-material-recipes.md | Type: material-recipe Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |
| material-recipe/single-map-material-field-schema | material-recipe | v0.2 | docs/world-visual-data-dictionary/material-recipe/single-map-material-field-schema.md | Type: material-recipe Version: v0.2 Updated: 2026-07-08 14:03:25 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| material-recipe/natural-home-material-recipes | material_recipe_missing | Generation task does not provide material recipes. |
| material-recipe/natural-home-material-recipes | grass_recipe_noise | Grass material ignores layered readable recipe and becomes noise. |
| material-recipe/natural-home-material-recipes | path_recipe_pasted | Dirt path ignores embedded transition recipe and looks pasted. |
| material-recipe/natural-home-material-recipes | water_recipe_synthetic | Water ignores natural recipe and becomes neon/noisy/synthetic. |
| material-recipe/natural-home-material-recipes | shoreline_recipe_wall | Shoreline ignores transition recipe and becomes wall/strip. |
| material-recipe/natural-home-material-recipes | detail_recipe_overload | Detail marks overpower gameplay structure. |
| material-recipe/single-map-material-field-schema | single_map_material_fields_missing | Single-map generation task lacks required material fields. |
| material-recipe/single-map-material-field-schema | material_role_unclear | Material does not communicate its map role. |
| material-recipe/single-map-material-field-schema | material_value_band_conflict | Material value range breaks route, center or water readability. |
| material-recipe/single-map-material-field-schema | material_transition_missing | Material edge lacks required transition behavior. |
| material-recipe/single-map-material-field-schema | material_detail_budget_exceeded | Material detail becomes uncontrolled noise. |

### composition-recipe/

职责：单一地图构图方法：阅读顺序、主次层级、开放空间、细节节奏。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| composition-recipe/game-map-composition-recipe | composition-recipe | v0.2 | docs/world-visual-data-dictionary/composition-recipe/game-map-composition-recipe.md | Type: composition-recipe Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |
| composition-recipe/single-map-composition-fields | composition-recipe | v0.2 | docs/world-visual-data-dictionary/composition-recipe/single-map-composition-fields.md | Type: composition-recipe Version: v0.2 Updated: 2026-07-08 14:03:25 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| composition-recipe/game-map-composition-recipe | composition_recipe_missing | Generation task has no composition recipe. |
| composition-recipe/game-map-composition-recipe | read_order_failed | Player cannot read entrance, route, center, water and boundary in order. |
| composition-recipe/game-map-composition-recipe | focal_hierarchy_failed | Decorative details beat the main route or center. |
| composition-recipe/game-map-composition-recipe | negative_space_missing | Map has no readable open playable space. |
| composition-recipe/game-map-composition-recipe | detail_rhythm_random | Detail distribution feels random rather than composed. |
| composition-recipe/single-map-composition-fields | single_map_composition_fields_missing | Single-map generation task lacks required composition fields. |
| composition-recipe/single-map-composition-fields | entrance_route_center_not_composed | Entrance, route and center do not form one readable composition. |
| composition-recipe/single-map-composition-fields | water_boundary_not_composed | Water and boundary placement do not support the map. |
| composition-recipe/single-map-composition-fields | open_space_plan_missing | Map lacks planned open visual space. |
| composition-recipe/single-map-composition-fields | composition_depends_on_player_or_ui | Map read depends on player character, marker or UI not in current scope. |

### render-layer-recipe/

职责：渲染层级：地表、水、路径、岸线、物体脚印、物体、阴影、细节。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| render-layer-recipe/runtime-render-layer-recipe | render-layer-recipe | v0.2 | docs/world-visual-data-dictionary/render-layer-recipe/runtime-render-layer-recipe.md | Type: render-layer-recipe Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| render-layer-recipe/runtime-render-layer-recipe | render_layer_recipe_missing | Generation or compositor lacks render layer recipe. |
| render-layer-recipe/runtime-render-layer-recipe | render_layer_order_broken | Layers are composed in an order that breaks readability. |
| render-layer-recipe/runtime-render-layer-recipe | route_occluded_by_detail | Main route is hidden by details or objects. |
| render-layer-recipe/runtime-render-layer-recipe | center_occluded_by_detail | Home center is hidden by texture or objects. |
| render-layer-recipe/runtime-render-layer-recipe | object_without_contact_layer | Object appears without footprint/contact layer. |
| render-layer-recipe/runtime-render-layer-recipe | debug_layer_visible | Debug/fallback/program layer is visible as final game art. |

### quality-rubric/

职责：专业质量评分：游戏感、地图语法、材质、统一性、落地、单图完成度。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| quality-rubric/professional-map-quality-rubric | quality-rubric | v0.2 | docs/world-visual-data-dictionary/quality-rubric/professional-map-quality-rubric.md | Type: quality-rubric Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| quality-rubric/professional-map-quality-rubric | quality_rubric_missing | Review did not use the professional map quality rubric. |
| quality-rubric/professional-map-quality-rubric | quality_score_unstructured | Review result lacks category scores and structured failure codes. |
| quality-rubric/professional-map-quality-rubric | machine_score_overrides_owner | Machine score incorrectly overrides owner rejection. |
| quality-rubric/professional-map-quality-rubric | near_pass_without_fix_targets | Near-pass frame lacks next repair targets. |
| quality-rubric/professional-map-quality-rubric | professional_score_below_gate | Frame score is below professional display gate. |

### composition/

职责：层级顺序、地图可读性和专业游戏画面标准。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| composition/layer-order | composition rule | v0.1 | docs/world-visual-data-dictionary/composition/layer-order.md | Type: composition rule Version: v0.1 The first world map must be composed in readable game layers. A professional |
| composition/map-readability | composition rule | v0.1 | docs/world-visual-data-dictionary/composition/map-readability.md | Type: composition rule Version: v0.1 The map must read as a playable world before it reads as a painting. This means |
| composition/professional-quality | composition rule | v0.1 | docs/world-visual-data-dictionary/composition/professional-quality.md | Type: composition rule Version: v0.1 This file defines the first human-level visual bar. It is stricter than the |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| composition/layer-order | collapsed_layers | Terrain, details and objects visually merge into unreadable noise. |
| composition/layer-order | pasted_objects | Objects appear as stickers without contact or shared light. |
| composition/layer-order | layer_order_conflict | Details cover important path/water/object edges in a way that breaks reading. |
| composition/map-readability | no_clear_route | Path route cannot be followed. |
| composition/map-readability | no_clear_center | Home-center/central clearing cannot be identified. |
| composition/map-readability | water_land_confusion | Water and land are visually confused. |
| composition/map-readability | professional_read_fail | The image may be decorative but does not read as a playable map. |
| composition/professional-quality | not_game_ready | Does not look ready for a first playable game map. |
| composition/professional-quality | no_art_direction | No stable visual language is visible. |
| composition/professional-quality | target_not_learned | Repeated outputs ignore this dictionary and require training/data adjustment. |

### director/

职责：导演如何将世界事实、失败码、规则转成单一地图生成任务。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| director/director-contract | director | v0.2 | docs/world-visual-data-dictionary/director/director-contract.md | Type: director Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| director/director-output-schema | director | v0.2 | docs/world-visual-data-dictionary/director/director-output-schema.md | Type: director Version: v0.2 Updated: 2026-07-08 14:15:32 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| director/director-contract | director_invents_world_fact | Director adds a fact not present in runtime state or version scope. |
| director/director-contract | director_missing_map_grammar | Director task lacks entrance, route, center, water edge, or boundary requirements. |
| director/director-contract | director_ignores_fix_plan | Previous structured failures are not used in the next task. |
| director/director-contract | director_allows_player_visible_candidate | Director marks a generation task or candidate as player-visible. |
| director/director-contract | director_unstructured_prompt_only | Director sends loose prompt text without structured generation condition. |
| director/director-output-schema | director_output_missing_required_field | Director output is missing a required planning field. |
| director/director-output-schema | director_missing_read_order | Director output does not define player read order. |
| director/director-output-schema | director_missing_safety_block | Director output lacks no-fact-rewrite or no-player-visible safety rules. |
| director/director-output-schema | director_fix_plan_not_bound | Director output does not bind previous failure codes to next task. |
| director/director-output-schema | director_missing_drawing_process_plan | Director output lacks drawingProcessPlan. |
| director/director-output-schema | director_missing_art_direction_plan | Director output lacks artDirectionPlan. |
| director/director-output-schema | director_missing_material_recipe_plan | Director output lacks materialRecipePlan. |
| director/director-output-schema | director_missing_composition_recipe_plan | Director output lacks compositionRecipePlan. |
| director/director-output-schema | director_missing_render_layer_recipe_plan | Director output lacks renderLayerRecipePlan. |
| director/director-output-schema | director_missing_quality_rubric_plan | Director output lacks qualityRubricPlan. |
| director/director-output-schema | director_missing_single_map_scope_plan | Director output lacks singleMapScopePlan. |
| director/director-output-schema | director_missing_single_map_ecology_plan | Director output lacks singleMapEcologyPlan. |
| director/director-output-schema | director_missing_single_map_material_plan | Director output lacks singleMapMaterialPlan. |
| director/director-output-schema | director_missing_single_map_composition_plan | Director output lacks singleMapCompositionPlan. |
| director/director-output-schema | director_missing_single_map_acceptance_plan | Director output lacks singleMapAcceptancePlan. |

### generation-task/

职责：小模型完整单一地图 RuntimeFrame 推理任务包结构。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| generation-task/runtime-frame-generation-task | generation-task | v0.2 | docs/world-visual-data-dictionary/generation-task/runtime-frame-generation-task.md | Type: generation-task Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| generation-task/task-package-schema | generation-task | v0.2 | docs/world-visual-data-dictionary/generation-task/task-package-schema.md | Type: generation-task Version: v0.2 Updated: 2026-07-08 14:15:32 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| generation-task/runtime-frame-generation-task | loose_prompt_only_generation | Generation used loose prompt text without structured task package. |
| generation-task/runtime-frame-generation-task | missing_task_storage | Generated image exists without full task, model, review, or failure records. |
| generation-task/runtime-frame-generation-task | missing_runtime_binding | Generation task is not bound to worldId, tick, and dictionaryVersionId. |
| generation-task/runtime-frame-generation-task | missing_previous_failure_feedback | Previous failure codes are not included in the next task. |
| generation-task/runtime-frame-generation-task | generation_target_not_runtime_frame | Task asks for local material, crop, or decorative image instead of complete RuntimeFrame. |
| generation-task/task-package-schema | task_schema_missing_required_field | Task package is missing a required top-level field. |
| generation-task/task-package-schema | task_missing_required_map_part | Task package does not require entrance, main path, home center, water edge or boundary. |
| generation-task/task-package-schema | task_missing_spatial_layers | Task package does not include walkable, collision or object footprint layers. |
| generation-task/task-package-schema | task_storage_contract_incomplete | Task package does not require full automatic storage and review records. |
| generation-task/task-package-schema | task_previous_failures_dropped | Previous failure codes are absent from the next task package. |
| generation-task/task-package-schema | task_missing_drawing_process | Task package lacks drawingProcess data. |
| generation-task/task-package-schema | task_missing_art_direction | Task package lacks professional artDirection data. |
| generation-task/task-package-schema | task_missing_material_recipes | Task package lacks required materialRecipes. |
| generation-task/task-package-schema | task_missing_composition_recipe | Task package lacks compositionRecipe data. |
| generation-task/task-package-schema | task_missing_render_layer_recipe | Task package lacks renderLayerRecipe data. |
| generation-task/task-package-schema | task_missing_quality_rubric | Task package lacks qualityRubric data. |
| generation-task/task-package-schema | task_missing_single_map_scope | Task package lacks current singleMapScope data. |
| generation-task/task-package-schema | task_missing_single_map_ecology_fields | Task package lacks singleMapEcologyFields data. |
| generation-task/task-package-schema | task_missing_single_map_material_fields | Task package lacks singleMapMaterialFields data. |
| generation-task/task-package-schema | task_missing_single_map_composition_fields | Task package lacks singleMapCompositionFields data. |
| generation-task/task-package-schema | task_missing_single_map_acceptance | Task package lacks singleMapAcceptance data. |

### review/

职责：单一地图通过标准、失败码和人工/机器审核规则。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| review/acceptance | review dictionary | v0.1 | docs/world-visual-data-dictionary/review/acceptance.md | Type: review dictionary Version: v0.1 Updated: 2026-07-08 14:03:25 +08:00 |
| review/failure-codes | review dictionary | v0.1 | docs/world-visual-data-dictionary/review/failure-codes.md | Type: review dictionary Version: v0.1 Updated: 2026-07-08 14:26:44 +08:00 |
| review/single-map-visual-acceptance | review dictionary | v0.2 | docs/world-visual-data-dictionary/review/single-map-visual-acceptance.md | Type: review dictionary Version: v0.2 Updated: 2026-07-08 14:03:25 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| review/single-map-visual-acceptance | single_map_acceptance_missing | Review did not use the current single-map acceptance standard. |
| review/single-map-visual-acceptance | single_map_scope_failed | Candidate is not one complete map visual. |
| review/single-map-visual-acceptance | reserved_player_gate_used | Review used player-character requirements in current scope. |
| review/single-map-visual-acceptance | reserved_interaction_gate_used | Review used interaction mechanics in current scope. |
| review/single-map-visual-acceptance | reserved_dynamic_gate_used | Review used multi-tick dynamic variation in current scope. |

### training/

职责：正负样本标签、自动存储和反馈闭环。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| training/automatic-storage | training rule | v0.1 | docs/world-visual-data-dictionary/training/automatic-storage.md | Type: training rule Version: v0.1 The local program, not Codex memory, must store every important training and |
| training/feedback-loop | training dictionary | v0.1 | docs/world-visual-data-dictionary/training/feedback-loop.md | Type: training dictionary Version: v0.1 The model must learn from both technical failures and owner visual failures. |
| training/sample-labels | training dictionary | v0.1 | docs/world-visual-data-dictionary/training/sample-labels.md | Type: training dictionary Version: v0.1 Updated: 2026-07-08 12:52:59 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| training/automatic-storage | inference_not_saved | Model output was generated but not stored. |
| training/automatic-storage | review_not_saved | Review happened but cannot be found in project records. |
| training/automatic-storage | no_negative_memory | Failed outputs are not available for future training. |
| training/automatic-storage | unstored_training_content | Training content is visible or discussed but has no stored record. |
| training/automatic-storage | page_bypasses_storage | Page shows training content without reading the stored record first. |

### schema/

职责：字典条目和审核记录的数据结构。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| schema/dictionary-entry | schema | v0.1 | docs/world-visual-data-dictionary/schema/dictionary-entry.md | Type: schema Version: v0.1 Every visual dictionary item should follow a stable shape so code, local model |
| schema/review-record | schema | v0.1 | docs/world-visual-data-dictionary/schema/review-record.md | Type: schema Version: v0.1 Every model inference, generated map, failed frame and accepted frame must be |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| schema/dictionary-entry | missing_required_field | Dictionary item cannot be used by automation. |
| schema/dictionary-entry | duplicate_meaning | Two files define the same object or rule with different names. |
| schema/dictionary-entry | vague_name | Name does not reveal the object or rule directly. |
| schema/review-record | missing_image_path | Review record cannot prove what was judged. |
| schema/review-record | missing_failure_codes | Failed sample cannot train the model. |
| schema/review-record | manual_only_memory | Result exists only in conversation and not in project data. |

### database/

职责：未来数据库表、版本、同步、迁移和存储规划。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| database/schema-draft | database schema draft | v0.1 | docs/world-visual-data-dictionary/database/schema-draft.md | Type: database schema draft Version: v0.1 Updated: 2026-07-08 12:52:59 +08:00 |
| database/storage-plan | database plan | v0.1 | docs/world-visual-data-dictionary/database/storage-plan.md | Type: database plan Version: v0.1 Updated: 2026-07-08 12:52:59 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| database/storage-plan | db_without_versioning | Database stores mutable rules without version identity. |
| database/storage-plan | db_review_not_linked | Review records are not linked to dictionary version and model checkpoint. |
| database/storage-plan | db_binary_blob_first | Database stores large images directly before asset/file storage is planned. |
| database/storage-plan | docs_db_diverge | Documents and database disagree without a migration/export record. |

### versions/

职责：第一版自然家园地图边界、当前单一地图范围和晋级规则。

| 条目 ID | 类型 | 版本 | 源文件 | 摘要 |
| --- | --- | --- | --- | --- |
| versions/current-single-map-visual-scope | version boundary | v0.2 | docs/world-visual-data-dictionary/versions/current-single-map-visual-scope.md | Type: version boundary Version: v0.2 Updated: 2026-07-08 13:58:07 +08:00 |
| versions/mvp-natural-home | version boundary | v0.1 | docs/world-visual-data-dictionary/versions/mvp-natural-home.md | Type: version boundary Version: v0.1 Updated: 2026-07-08 13:58:07 +08:00 |

| 来源条目 | Hard Failure | 含义 |
| --- | --- | --- |
| versions/current-single-map-visual-scope | active_scope_player_feature_leak | Current single-map visual task includes player-character requirements. |
| versions/current-single-map-visual-scope | active_scope_interaction_feature_leak | Current single-map visual task includes click, collect, build or inspect requirements. |
| versions/current-single-map-visual-scope | active_scope_gameplay_gate_used | Current review fails or passes based on gameplay systems outside current scope. |
| versions/current-single-map-visual-scope | active_scope_dynamic_tick_required | Current review requires multi-tick visual variation outside current scope. |
| versions/mvp-natural-home | partial_candidate_not_full_world | Candidate has useful local quality, but it is not a complete first playable world map. |
| versions/mvp-natural-home | missing_complete_map_structure | Image does not show the full entrance/path/center/water/boundary composition. |
| versions/mvp-natural-home | active_scope_player_feature_leak | Current single-map visual task includes player-character requirements. |
| versions/mvp-natural-home | active_scope_interaction_feature_leak | Current single-map visual task includes click, collect, build or inspect requirements. |

## 7. 注册失败码总表

| 序号 | 失败码 | 含义 | 修复目标 |
| --- | --- | --- | --- |
| 1 | grass_green_noise_field | Grass reads as noisy or dirty texture. | `terrain/grass.md` |
| 2 | grass_muddy_blur | Grass is brown-green smear. | `terrain/grass.md` |
| 3 | dirt_path_color_band | Path is a pasted warm color band. | `terrain/dirt-path.md` |
| 4 | dirt_path_brick_repetition | Path has repeated brick/tile feeling. | `terrain/dirt-path.md` |
| 5 | shoreline_pasted_wall | Shoreline looks like a vertical wall or pasted strip. | `terrain/shoreline.md` |
| 6 | water_electric_noise | Water is neon/noisy/synthetic. | `terrain/water.md` |
| 7 | object_sticker_asset | Object looks pasted from another source. | `visual-style/object-grounding.md` |
| 8 | object_floating_asset | Object lacks contact with ground. | `visual-style/object-grounding.md` |
| 9 | camera_perspective_mismatch | Elements use conflicting camera angles. | `visual-style/camera.md` |
| 10 | structure_unreadable | Entrance, center, path or boundary cannot be read. | `map-structure/` |
| 11 | style_palette_mismatch | Object and terrain palette/style do not match. | `visual-style/color.md` |
| 12 | full_frame_noise | Whole frame is dominated by uniform noise texture. | `visual-style/material-density.md` |
| 13 | machine_pass_owner_fail | Machine checks passed but owner rejects visual quality. | training negative sample |
| 14 | machine_pass_agent_fail | Machine checks passed but early agent professional review rejects visual quality. | training negative sample |
| 15 | not_game_ready | Frame does not look ready for a first playable game map. | `composition/professional-quality.md` |
| 16 | professional_read_fail | Frame may contain terrain pieces but does not read as a professional playable map. | `composition/map-readability.md` |
| 17 | no_clear_route | Main path or route cannot be followed clearly. | `composition/map-readability.md` |
| 18 | no_clear_center | Home-center or central clearing cannot be identified. | `map-structure/home-center.md` |
| 19 | water_land_confusion | Water and land do not separate clearly enough for map reading. | `composition/map-readability.md` |
| 20 | pasted_objects | Objects appear pasted instead of grounded in the world. | `composition/layer-order.md` |
| 21 | no_art_direction | Frame has no stable camera, lighting and material language. | `composition/professional-quality.md` |
| 22 | full_frame_low_contrast | Frame is too flat to read structure clearly. | `composition/map-readability.md` |
| 23 | machine_pass_owner_review_required | Machine/runtime says ready, but owner/professional review is still required. | `review/acceptance.md` |
| 24 | partial_candidate_not_full_world | Candidate quality is useful, but it is a local/crop candidate rather than a complete RuntimeFrame world map. | `versions/mvp-natural-home.md` |
| 25 | missing_world_ontology | Generation task has visuals but no clear world entities or facts. | `world-ontology/entity-taxonomy.md` |
| 26 | invented_major_entity | Image contains major buildings, roads, characters, objects, or events not present in world facts. | `world-ontology/entity-taxonomy.md` |
| 27 | missing_required_entity | Required first-version structure or terrain entity is absent. | `world-ontology/entity-taxonomy.md` |
| 28 | unbound_visible_entity | Visible major entity cannot be traced to world facts or version scope. | `world-ontology/entity-taxonomy.md` |
| 29 | entity_scope_mismatch | Image shows a feature outside the current dictionary version boundary. | `world-ontology/entity-taxonomy.md` |
| 30 | missing_spatial_contract | Frame cannot map visual content to walkable, collision or interaction layers. | `spatial-grid/grid-and-layer-contract.md` |
| 31 | visual_logic_mismatch | Visual walkability or collision does not match runtime layer meaning. | `spatial-grid/grid-and-layer-contract.md` |
| 32 | unreadable_walkable_area | Player cannot tell where movement is allowed. | `spatial-grid/grid-and-layer-contract.md` |
| 33 | unreadable_collision_area | Blocked regions are not visually justified. | `spatial-grid/grid-and-layer-contract.md` |
| 34 | broken_route_continuity | Path is visually interrupted or disconnected. | `spatial-grid/grid-and-layer-contract.md` |
| 35 | object_footprint_missing | Object lacks clear contact footprint in spatial layer. | `spatial-grid/grid-and-layer-contract.md` |
| 36 | missing_map_grammar | Map has assets but no readable complete-game structure. | `map-grammar/complete-map-grammar.md` |
| 37 | missing_complete_map_part | Required entrance, route, center, water edge, boundary, or object cluster is absent. | `map-grammar/complete-map-grammar.md` |
| 38 | route_hierarchy_missing | Main and branch routes cannot be distinguished. | `map-grammar/complete-map-grammar.md` |
| 39 | center_swallowed_by_texture | Home center exists but is unreadable because of texture or clutter. | `map-grammar/complete-map-grammar.md` |
| 40 | boundary_hard_clip | Map edge reads as cropped rectangle rather than natural boundary. | `map-grammar/complete-map-grammar.md` |
| 41 | random_asset_scatter | Objects do not support route, center, water edge, or boundary grammar. | `map-grammar/complete-map-grammar.md` |
| 42 | ecology_random_noise | Natural details look randomly sprayed rather than ecologically related. | `ecology/ecology-state-rules.md` |
| 43 | vegetation_density_overload | Vegetation density hides map structure or route readability. | `ecology/ecology-state-rules.md` |
| 44 | water_ecology_mismatch | Water edge lacks wetland, shore, or transition logic. | `ecology/ecology-state-rules.md` |
| 45 | path_wear_missing | Path does not affect surrounding grass or ground. | `ecology/ecology-state-rules.md` |
| 46 | biome_style_mismatch | Plants, terrain, and color imply conflicting biomes. | `ecology/ecology-state-rules.md` |
| 47 | no_playable_read | Image looks decorative but not playable. | `gameplay/playability-contract.md` |
| 48 | movement_affordance_missing | Player cannot infer where movement is possible. | `gameplay/playability-contract.md` |
| 49 | collision_affordance_missing | Blocked areas are not visually explained. | `gameplay/playability-contract.md` |
| 50 | interaction_cue_noise | Decorative details compete with future interaction points. | `gameplay/playability-contract.md` |
| 51 | player_scale_conflict | Path, objects, and open areas imply incompatible player scale. | `gameplay/playability-contract.md` |
| 52 | missing_runtime_state_contract | Frame cannot belong to a live tick or future world change. | `runtime-state/live-map-state.md` |
| 53 | tick_unbound_frame | Frame is not bound to worldId and tick. | `runtime-state/live-map-state.md` |
| 54 | state_diff_untraceable | Visual change cannot be traced to runtime state. | `runtime-state/live-map-state.md` |
| 55 | unstable_world_identity | Same world changes style or layout without a state reason. | `runtime-state/live-map-state.md` |
| 56 | visual_repair_rewrites_facts | Visual fix changes stored world facts instead of regenerating expression. | `runtime-state/live-map-state.md` |
| 57 | missing_review_link | RuntimeFrame lacks link to generation and review records. | `runtime-state/live-map-state.md` |
| 58 | missing_director_contract | System has generation but no stable director instruction layer. | `director/director-contract.md` |
| 59 | director_invents_world_fact | Director adds a fact not present in runtime state or version scope. | `director/director-contract.md` |
| 60 | director_missing_map_grammar | Director task lacks entrance, route, center, water edge, or boundary requirements. | `director/director-contract.md` |
| 61 | director_ignores_fix_plan | Previous structured failures are not used in the next task. | `director/director-contract.md` |
| 62 | director_allows_player_visible_candidate | Director marks a generation task or candidate as player-visible. | `director/director-contract.md` |
| 63 | director_unstructured_prompt_only | Director sends loose prompt text without structured generation condition. | `director/director-contract.md` |
| 64 | missing_generation_task_package | Local model receives loose text instead of a complete structured task package. | `generation-task/runtime-frame-generation-task.md` |
| 65 | loose_prompt_only_generation | Generation used loose prompt text without structured task package. | `generation-task/runtime-frame-generation-task.md` |
| 66 | missing_task_storage | Generated image exists without full task, model, review, or failure records. | `generation-task/runtime-frame-generation-task.md` |
| 67 | missing_runtime_binding | Generation task is not bound to worldId, tick, and dictionaryVersionId. | `generation-task/runtime-frame-generation-task.md` |
| 68 | missing_previous_failure_feedback | Previous failure codes are not included in the next task. | `generation-task/runtime-frame-generation-task.md` |
| 69 | generation_target_not_runtime_frame | Task asks for local material, crop, or decorative image instead of complete RuntimeFrame. | `generation-task/runtime-frame-generation-task.md` |
| 70 | task_schema_missing_required_field | Task package is missing a required top-level field. | `generation-task/task-package-schema.md` |
| 71 | task_missing_required_map_part | Task package does not require entrance, main path, home center, water edge or boundary. | `generation-task/task-package-schema.md` |
| 72 | task_missing_spatial_layers | Task package does not include walkable, collision or object footprint layers. | `generation-task/task-package-schema.md` |
| 73 | task_storage_contract_incomplete | Task package does not require full automatic storage and review records. | `generation-task/task-package-schema.md` |
| 74 | task_previous_failures_dropped | Previous failure codes are absent from the next task package. | `generation-task/task-package-schema.md` |
| 75 | director_output_missing_required_field | Director output is missing a required planning field. | `director/director-output-schema.md` |
| 76 | director_missing_read_order | Director output does not define player read order. | `director/director-output-schema.md` |
| 77 | director_missing_safety_block | Director output lacks no-fact-rewrite or no-player-visible safety rules. | `director/director-output-schema.md` |
| 78 | director_fix_plan_not_bound | Director output does not bind previous failure codes to next task. | `director/director-output-schema.md` |
| 79 | map_part_schema_missing_field | Map grammar part lacks required schema fields. | `map-grammar/map-part-schema.md` |
| 80 | map_part_connection_missing | Required connection between map parts is absent. | `map-grammar/map-part-schema.md` |
| 81 | map_part_role_conflict | Walkable, collision, interaction, or visual role conflicts. | `map-grammar/map-part-schema.md` |
| 82 | map_part_unreadable | Required map part exists structurally but cannot be read visually. | `map-grammar/map-part-schema.md` |
| 83 | layer_record_schema_missing_field | Spatial layer record lacks required schema fields. | `spatial-grid/layer-record-schema.md` |
| 84 | layer_geometry_missing | Spatial layer record has no usable geometry. | `spatial-grid/layer-record-schema.md` |
| 85 | layer_visual_cue_missing | Spatial layer has no visible cue binding. | `spatial-grid/layer-record-schema.md` |
| 86 | collision_walkable_overlap_unresolved | Walkable and collision regions overlap without a rule. | `spatial-grid/layer-record-schema.md` |
| 87 | object_footprint_geometry_mismatch | Object footprint geometry does not match visible object contact. | `spatial-grid/layer-record-schema.md` |
| 88 | missing_drawing_process | Generation did not store the drawing-process data. | `drawing-method/ai-drawing-process.md` |
| 89 | skipped_spatial_blockout | Image jumped into texture/detail without a readable layout blockout. | `drawing-method/ai-drawing-process.md` |
| 90 | skipped_value_grouping | Image has materials but no readable light/dark structure. | `drawing-method/ai-drawing-process.md` |
| 91 | skipped_grounding_pass | Objects and edges were not integrated into terrain. | `drawing-method/ai-drawing-process.md` |
| 92 | polish_without_structure | Image has detail but lacks professional map structure. | `drawing-method/ai-drawing-process.md` |
| 93 | art_direction_missing | Frame has no stable professional game art direction. | `art-direction/professional-game-art-direction.md` |
| 94 | not_player_facing_art | Frame looks like training output or debug preview, not a player-facing map. | `art-direction/professional-game-art-direction.md` |
| 95 | style_family_mixed | Terrain, objects or water belong to conflicting art styles. | `art-direction/professional-game-art-direction.md` |
| 96 | gameplay_read_not_supported | Art direction does not support route, movement or interaction readability. | `art-direction/professional-game-art-direction.md` |
| 97 | detail_density_unprofessional | Detail density is empty, noisy, or uncontrolled. | `art-direction/professional-game-art-direction.md` |
| 98 | material_recipe_missing | Generation task does not provide material recipes. | `material-recipe/natural-home-material-recipes.md` |
| 99 | grass_recipe_noise | Grass material ignores layered readable recipe and becomes noise. | `material-recipe/natural-home-material-recipes.md` |
| 100 | path_recipe_pasted | Dirt path ignores embedded transition recipe and looks pasted. | `material-recipe/natural-home-material-recipes.md` |
| 101 | water_recipe_synthetic | Water ignores natural recipe and becomes neon/noisy/synthetic. | `material-recipe/natural-home-material-recipes.md` |
| 102 | shoreline_recipe_wall | Shoreline ignores transition recipe and becomes wall/strip. | `material-recipe/natural-home-material-recipes.md` |
| 103 | detail_recipe_overload | Detail marks overpower gameplay structure. | `material-recipe/natural-home-material-recipes.md` |
| 104 | composition_recipe_missing | Generation task has no composition recipe. | `composition-recipe/game-map-composition-recipe.md` |
| 105 | read_order_failed | Player cannot read entrance, route, center, water and boundary in order. | `composition-recipe/game-map-composition-recipe.md` |
| 106 | focal_hierarchy_failed | Decorative details beat the main route or center. | `composition-recipe/game-map-composition-recipe.md` |
| 107 | negative_space_missing | Map has no readable open playable space. | `composition-recipe/game-map-composition-recipe.md` |
| 108 | detail_rhythm_random | Detail distribution feels random rather than composed. | `composition-recipe/game-map-composition-recipe.md` |
| 109 | render_layer_recipe_missing | Generation or compositor lacks render layer recipe. | `render-layer-recipe/runtime-render-layer-recipe.md` |
| 110 | render_layer_order_broken | Layers are composed in an order that breaks readability. | `render-layer-recipe/runtime-render-layer-recipe.md` |
| 111 | route_occluded_by_detail | Main route is hidden by details or objects. | `render-layer-recipe/runtime-render-layer-recipe.md` |
| 112 | center_occluded_by_detail | Home center is hidden by texture or objects. | `render-layer-recipe/runtime-render-layer-recipe.md` |
| 113 | object_without_contact_layer | Object appears without footprint/contact layer. | `render-layer-recipe/runtime-render-layer-recipe.md` |
| 114 | debug_layer_visible | Debug/fallback/program layer is visible as final game art. | `render-layer-recipe/runtime-render-layer-recipe.md` |
| 115 | quality_rubric_missing | Review did not use the professional map quality rubric. | `quality-rubric/professional-map-quality-rubric.md` |
| 116 | quality_score_unstructured | Review result lacks category scores and structured failure codes. | `quality-rubric/professional-map-quality-rubric.md` |
| 117 | machine_score_overrides_owner | Machine score incorrectly overrides owner rejection. | `quality-rubric/professional-map-quality-rubric.md` |
| 118 | near_pass_without_fix_targets | Near-pass frame lacks next repair targets. | `quality-rubric/professional-map-quality-rubric.md` |
| 119 | professional_score_below_gate | Frame score is below professional display gate. | `quality-rubric/professional-map-quality-rubric.md` |
| 120 | task_missing_drawing_process | Task package lacks drawingProcess data. | `generation-task/task-package-schema.md` |
| 121 | task_missing_art_direction | Task package lacks professional artDirection data. | `generation-task/task-package-schema.md` |
| 122 | task_missing_material_recipes | Task package lacks required materialRecipes. | `generation-task/task-package-schema.md` |
| 123 | task_missing_composition_recipe | Task package lacks compositionRecipe data. | `generation-task/task-package-schema.md` |
| 124 | task_missing_render_layer_recipe | Task package lacks renderLayerRecipe data. | `generation-task/task-package-schema.md` |
| 125 | task_missing_quality_rubric | Task package lacks qualityRubric data. | `generation-task/task-package-schema.md` |
| 126 | director_missing_drawing_process_plan | Director output lacks drawingProcessPlan. | `director/director-output-schema.md` |
| 127 | director_missing_art_direction_plan | Director output lacks artDirectionPlan. | `director/director-output-schema.md` |
| 128 | director_missing_material_recipe_plan | Director output lacks materialRecipePlan. | `director/director-output-schema.md` |
| 129 | director_missing_composition_recipe_plan | Director output lacks compositionRecipePlan. | `director/director-output-schema.md` |
| 130 | director_missing_render_layer_recipe_plan | Director output lacks renderLayerRecipePlan. | `director/director-output-schema.md` |
| 131 | director_missing_quality_rubric_plan | Director output lacks qualityRubricPlan. | `director/director-output-schema.md` |
| 132 | entity_record_schema_missing_field | World entity record lacks required schema fields. | `world-ontology/world-entity-record-schema.md` |
| 133 | runtime_entity_missing_source_fact | Runtime-only entity has no sourceFactId. | `world-ontology/world-entity-record-schema.md` |
| 134 | visible_entity_missing_visual_entry | Visible entity has no allowed visual dictionary entry. | `world-ontology/world-entity-record-schema.md` |
| 135 | visible_entity_missing_placement_domain | Visible entity has no placement domain. | `world-ontology/world-entity-record-schema.md` |
| 136 | forbidden_entity_in_task | Forbidden entity appears in generation task or candidate frame. | `world-ontology/world-entity-record-schema.md` |
| 137 | runtime_binding_schema_missing_field | Runtime frame state binding lacks required fields. | `runtime-state/runtime-frame-state-binding-schema.md` |
| 138 | runtime_binding_missing_generation_trace | Binding lacks director or generation task id. | `runtime-state/runtime-frame-state-binding-schema.md` |
| 139 | runtime_binding_missing_asset_trace | Binding lacks generated asset id or image hash link. | `runtime-state/runtime-frame-state-binding-schema.md` |
| 140 | runtime_binding_missing_review_trace | Binding lacks review record id. | `runtime-state/runtime-frame-state-binding-schema.md` |
| 141 | runtime_binding_missing_state_trace | Binding lacks sourceFactIds or stateDiffIds. | `runtime-state/runtime-frame-state-binding-schema.md` |
| 142 | runtime_binding_world_gate_bypass | canEnterWorld is true without required review gates. | `runtime-state/runtime-frame-state-binding-schema.md` |
| 143 | active_scope_player_feature_leak | Current single-map visual task includes player-character requirements. | `versions/current-single-map-visual-scope.md` |
| 144 | active_scope_interaction_feature_leak | Current single-map visual task includes click, collect, build or inspect requirements. | `versions/current-single-map-visual-scope.md` |
| 145 | active_scope_gameplay_gate_used | Current review fails or passes based on gameplay systems outside current scope. | `versions/current-single-map-visual-scope.md` |
| 146 | active_scope_dynamic_tick_required | Current review requires multi-tick visual variation outside current scope. | `versions/current-single-map-visual-scope.md` |
| 147 | single_map_ecology_fields_missing | Single-map generation task lacks required ecology fields. | `ecology/single-map-ecology-fields.md` |
| 148 | moisture_map_unreadable | Dry/wet/shoreline/open grass zones cannot be read. | `ecology/single-map-ecology-fields.md` |
| 149 | grass_growth_ignores_path | Grass density does not respond to the path. | `ecology/single-map-ecology-fields.md` |
| 150 | shoreline_ecology_missing | Water edge lacks wet grass, reeds or natural transition cues. | `ecology/single-map-ecology-fields.md` |
| 151 | boundary_vegetation_wall | Boundary vegetation becomes a flat wall instead of natural framing. | `ecology/single-map-ecology-fields.md` |
| 152 | single_map_material_fields_missing | Single-map generation task lacks required material fields. | `material-recipe/single-map-material-field-schema.md` |
| 153 | material_role_unclear | Material does not communicate its map role. | `material-recipe/single-map-material-field-schema.md` |
| 154 | material_value_band_conflict | Material value range breaks route, center or water readability. | `material-recipe/single-map-material-field-schema.md` |
| 155 | material_transition_missing | Material edge lacks required transition behavior. | `material-recipe/single-map-material-field-schema.md` |
| 156 | material_detail_budget_exceeded | Material detail becomes uncontrolled noise. | `material-recipe/single-map-material-field-schema.md` |
| 157 | single_map_composition_fields_missing | Single-map generation task lacks required composition fields. | `composition-recipe/single-map-composition-fields.md` |
| 158 | entrance_route_center_not_composed | Entrance, route and center do not form one readable composition. | `composition-recipe/single-map-composition-fields.md` |
| 159 | water_boundary_not_composed | Water and boundary placement do not support the map. | `composition-recipe/single-map-composition-fields.md` |
| 160 | open_space_plan_missing | Map lacks planned open visual space. | `composition-recipe/single-map-composition-fields.md` |
| 161 | composition_depends_on_player_or_ui | Map read depends on player character, marker or UI not in current scope. | `composition-recipe/single-map-composition-fields.md` |
| 162 | single_map_acceptance_missing | Review did not use the current single-map acceptance standard. | `review/single-map-visual-acceptance.md` |
| 163 | single_map_scope_failed | Candidate is not one complete map visual. | `review/single-map-visual-acceptance.md` |
| 164 | reserved_player_gate_used | Review used player-character requirements in current scope. | `review/single-map-visual-acceptance.md` |
| 165 | reserved_interaction_gate_used | Review used interaction mechanics in current scope. | `review/single-map-visual-acceptance.md` |
| 166 | reserved_dynamic_gate_used | Review used multi-tick dynamic variation in current scope. | `review/single-map-visual-acceptance.md` |
| 167 | task_missing_single_map_scope | Task package lacks current singleMapScope data. | `generation-task/task-package-schema.md` |
| 168 | task_missing_single_map_ecology_fields | Task package lacks singleMapEcologyFields data. | `generation-task/task-package-schema.md` |
| 169 | task_missing_single_map_material_fields | Task package lacks singleMapMaterialFields data. | `generation-task/task-package-schema.md` |
| 170 | task_missing_single_map_composition_fields | Task package lacks singleMapCompositionFields data. | `generation-task/task-package-schema.md` |
| 171 | task_missing_single_map_acceptance | Task package lacks singleMapAcceptance data. | `generation-task/task-package-schema.md` |
| 172 | director_missing_single_map_scope_plan | Director output lacks singleMapScopePlan. | `director/director-output-schema.md` |
| 173 | director_missing_single_map_ecology_plan | Director output lacks singleMapEcologyPlan. | `director/director-output-schema.md` |
| 174 | director_missing_single_map_material_plan | Director output lacks singleMapMaterialPlan. | `director/director-output-schema.md` |
| 175 | director_missing_single_map_composition_plan | Director output lacks singleMapCompositionPlan. | `director/director-output-schema.md` |
| 176 | director_missing_single_map_acceptance_plan | Director output lacks singleMapAcceptancePlan. | `director/director-output-schema.md` |
| 177 | arbitrary_path | Path exists visually but has no structure purpose. | `map-structure/main-path.md` |
| 178 | asset_palette_mismatch | Objects have unrelated colors/style. | `visual-style/color.md` |
| 179 | black_noise_rock | Rock reads as dark noise. | `objects/rock.md` |
| 180 | boundary_collision_mismatch | Visual boundary contradicts collision data. | `map-structure/natural-boundary.md` |
| 181 | boundary_noise | Boundary is unreadable dark/green noise. | `map-structure/natural-boundary.md` |
| 182 | branch_dominates_map | Secondary path steals focus from main structure. | `map-structure/branch-path.md` |
| 183 | brick_repetition | Path reads as repeated bricks/tiles instead of natural soil. | `terrain/dirt-path.md` |
| 184 | broken_route | Path visually fails to connect entrance, center or branch target. | `terrain/dirt-path.md` |
| 185 | broken_water_surface | Water breaks into unrelated blobs. | `terrain/water.md` |
| 186 | center_as_noise | Center is buried under texture. | `map-structure/home-center.md` |
| 187 | center_invasion | Boundary elements invade and hide the playable center. | `terrain/forest-edge.md` |
| 188 | collapsed_layers | Terrain, details and objects visually merge into unreadable noise. | `composition/layer-order.md` |
| 189 | collision_visual_conflict | Visual says walkable but collision says blocked, or the reverse. | `map-structure/walkable-area.md` |
| 190 | color_band_path | Path looks like a pasted color band. | `terrain/dirt-path.md` |
| 191 | conflicting_light | Different objects have different light directions. | `visual-style/light.md` |
| 192 | db_binary_blob_first | Database stores large images directly before asset/file storage is planned. | `database/storage-plan.md` |
| 193 | db_review_not_linked | Review records are not linked to dictionary version and model checkpoint. | `database/storage-plan.md` |
| 194 | db_without_versioning | Database stores mutable rules without version identity. | `database/storage-plan.md` |
| 195 | detail_noise | Detail becomes random surface noise. | `objects/grass-detail.md` |
| 196 | disconnected_entrance | Entrance does not connect to main path. | `map-structure/entrance.md` |
| 197 | disconnected_shore | Shoreline does not follow the water boundary. | `terrain/shoreline.md` |
| 198 | docs_db_diverge | Documents and database disagree without a migration/export record. | `database/storage-plan.md` |
| 199 | duplicate_meaning | Two files define the same object or rule with different names. | `schema/dictionary-entry.md` |
| 200 | edge_blur | Edges are so blurred that structure is unreadable. | `visual-style/edge-treatment.md` |
| 201 | electric_blue_noise | Water is neon, noisy or visually synthetic. | `terrain/water.md` |
| 202 | excessive_bright_berries | Berry accents become noisy bright pixels. | `objects/berry-bush.md` |
| 203 | false_obstacle | Pebbles look like major blockers. | `objects/pebble.md` |
| 204 | floating_asset | Object lacks contact shadow/base. | `visual-style/object-grounding.md` |
| 205 | floating_object | Object appears pasted without ground contact. | `baseline/earth.md` |
| 206 | floating_resource | No ground contact. | `objects/berry-bush.md` |
| 207 | floating_shrub | No base contact. | `objects/shrub.md` |
| 208 | floating_tree | Tree appears to hover. | `objects/tree.md` |
| 209 | full_frame_overgrowth | Tall grass covers the map and destroys readability. | `terrain/tall-grass.md` |
| 210 | gameplay_confusion | Mud hides path or water boundary. | `terrain/mud-patch.md` |
| 211 | green_blob | Shrub is only an unclear green blob. | `objects/shrub.md` |
| 212 | green_noise_field | Grass reads as random noise or dirty texture. | `terrain/grass.md` |
| 213 | hard_boundary_wall | Boundary looks artificial. | `map-structure/natural-boundary.md` |
| 214 | hard_cut_edge | Edge is perfectly sharp or geometric. | `terrain/dirt-path.md` |
| 215 | hard_cut_shore | Shoreline is a sharp mask edge. | `terrain/shoreline.md` |
| 216 | hard_mask_edge | Terrain masks are visibly hard-cut. | `visual-style/edge-treatment.md` |
| 217 | hidden_entrance | Player cannot tell where entry starts. | `map-structure/entrance.md` |
| 218 | indistinct_resource | Cannot distinguish from random grass noise. | `objects/berry-bush.md` |
| 219 | inference_not_saved | Model output was generated but not stored. | `training/automatic-storage.md` |
| 220 | inland_reed | Reeds appear far from water without reason. | `objects/reed.md` |
| 221 | invisible_collision | Movement is blocked with no visible reason. | `map-structure/collision-area.md` |
| 222 | layer_order_conflict | Details cover important path/water/object edges in a way that breaks reading. | `composition/layer-order.md` |
| 223 | low_detail_flatness | Large areas are flat and unfinished. | `visual-style/material-density.md` |
| 224 | manual_only_memory | Result exists only in conversation and not in project data. | `schema/review-record.md` |
| 225 | meaningless_branch | Branch path goes nowhere. | `map-structure/branch-path.md` |
| 226 | missing_center | No readable center exists. | `map-structure/home-center.md` |
| 227 | missing_complete_map_structure | Image does not show the full entrance/path/center/water/boundary composition. | `versions/mvp-natural-home.md` |
| 228 | missing_failure_codes | Failed sample cannot train the model. | `schema/review-record.md` |
| 229 | missing_image_path | Review record cannot prove what was judged. | `schema/review-record.md` |
| 230 | missing_required_field | Dictionary item cannot be used by automation. | `schema/dictionary-entry.md` |
| 231 | mixed_world_physics | Some elements behave like icons, others like 3D objects, breaking world consistency. | `baseline/earth.md` |
| 232 | muddy_blur | Grass becomes an unclear brown-green smear. | `terrain/grass.md` |
| 233 | muddy_map | Mud spreads across the full frame and makes grass dirty. | `terrain/mud-patch.md` |
| 234 | muddy_palette | Whole map becomes brown-green sludge. | `visual-style/color.md` |
| 235 | neon_noise | Saturated speckle artifacts dominate. | `visual-style/color.md` |
| 236 | no_contact_shadow | Objects float due to missing shadow/base. | `visual-style/light.md` |
| 237 | no_negative_memory | Failed outputs are not available for future training. | `training/automatic-storage.md` |
| 238 | noisy_clumps | Clumps become random dark stains. | `terrain/tall-grass.md` |
| 239 | noisy_dark_edge | Edge is a dark noise band. | `terrain/forest-edge.md` |
| 240 | noisy_stripes | Reeds become dense line noise. | `objects/reed.md` |
| 241 | non_earth_visual_logic | Water, soil, plant or stone no longer reads as Earth-like natural material. | `baseline/earth.md` |
| 242 | obstructed_main_path | Path appears blocked by tree, rock, water or noise. | `map-structure/main-path.md` |
| 243 | overbright_noise | Flowers create noisy bright speckles. | `objects/flower.md` |
| 244 | overdark_scene | Shadows hide gameplay structure. | `visual-style/light.md` |
| 245 | overgrown_path | Grass destroys path readability. | `terrain/grass.md` |
| 246 | overwide_shore | Shoreline covers too much land or water. | `terrain/shoreline.md` |
| 247 | page_bypasses_storage | Page shows training content without reading the stored record first. | `training/automatic-storage.md` |
| 248 | pale_patch_flower | Flower cluster becomes large pale flat patch. | `objects/flower.md` |
| 249 | pasted_edge | Objects or shoreline look pasted. | `visual-style/edge-treatment.md` |
| 250 | pasted_wall_shore | Shoreline looks like a vertical pasted wall. | `terrain/shoreline.md` |
| 251 | path_contamination | Tall grass hides or visually breaks the main path. | `terrain/tall-grass.md` |
| 252 | path_pollution | Flowers hide or dirty the path. | `objects/flower.md` |
| 253 | pebble_noise | Pebbles become salt-and-pepper noise. | `objects/pebble.md` |
| 254 | perspective_mismatch | Tree camera conflicts with map camera. | `objects/tree.md` |
| 255 | reed_wall | Reeds form a wall or block the water boundary. | `objects/reed.md` |
| 256 | repeated_dot_pattern | Pebbles form a visible grid or repeated dot stamp. | `objects/pebble.md` |
| 257 | repeated_material_stamp | Repeated tile or stamp is visible. | `visual-style/material-density.md` |
| 258 | repeated_stamp | Same detail repeats visibly. | `objects/grass-detail.md` |
| 259 | repeated_tile_grid | Repeated 64px/128px block pattern is visible. | `terrain/grass.md` |
| 260 | review_not_saved | Review happened but cannot be found in project records. | `training/automatic-storage.md` |
| 261 | scale_break | Object size breaks map scale. | `visual-style/object-grounding.md` |
| 262 | scale_mismatch | Rock scale conflicts with tree/path. | `objects/rock.md` |
| 263 | stain_noise | Mud looks like random stains. | `terrain/mud-patch.md` |
| 264 | sticker_asset | Object has no integration with ground. | `visual-style/object-grounding.md` |
| 265 | sticker_rock | No shadow or terrain contact. | `objects/rock.md` |
| 266 | sticker_tree | Tree looks pasted from another image/style. | `objects/tree.md` |
| 267 | structure_masking | Detail hides path, center or water boundary. | `objects/grass-detail.md` |
| 268 | style_mismatch | Shrub does not match trees/grass style. | `objects/shrub.md` |
| 269 | target_not_learned | Repeated outputs ignore this dictionary and require training/data adjustment. | `composition/professional-quality.md` |
| 270 | tree_wall | Boundary becomes a repeated tree wall. | `terrain/forest-edge.md` |
| 271 | unauthorized_building | Center becomes a building without world fact. | `map-structure/home-center.md` |
| 272 | unreadable_depth | No shallow/deep relation can be read. | `terrain/water.md` |
| 273 | unreadable_main_path | Main route cannot be recognized. | `map-structure/main-path.md` |
| 274 | unreadable_map_camera | Camera makes walkable space unclear. | `visual-style/camera.md` |
| 275 | unstored_training_content | Training content is visible or discussed but has no stored record. | `training/automatic-storage.md` |
| 276 | vague_name | Name does not reveal the object or rule directly. | `schema/dictionary-entry.md` |
| 277 | vertical_wall_water | Water edge looks like a pasted vertical wall or cliff strip. | `terrain/water.md` |
| 278 | visible_blocker_no_collision | Object looks blocking but data allows walking through it. | `map-structure/collision-area.md` |
| 279 | walkable_visual_blocked | Walkable area looks blocked. | `map-structure/walkable-area.md` |
| 280 | water_edge_confusion | Player cannot tell land from water. | `map-structure/water-edge-zone.md` |
| 281 | water_edge_wall | Edge looks like a wall or pasted strip. | `map-structure/water-edge-zone.md` |

## 8. 训练标签总表

| 序号 | 标签 | 含义 | 是否可训练 |
| --- | --- | --- | --- |
| 1 | positive_owner_accepted | Owner accepted as matching first-version target. | Yes |
| 2 | positive_machine_and_owner_passed | Machine and owner both passed. | Yes |
| 3 | positive_local_material_candidate | Local visual quality is useful for material/style training, but not enough for full world approval. | Yes, as local/material positive |
| 4 | negative_owner_rejected | Owner rejected visual quality. | Yes, as negative |
| 5 | negative_agent_rejected | Early agent professional review rejected visual quality before owner final review. | Yes, as negative candidate |
| 6 | negative_machine_failed | Machine failed visual/structure gate. | Yes, as negative |
| 7 | negative_machine_pass_owner_fail | Machine passed but owner rejected. | Yes, high-value negative |
| 8 | negative_machine_pass_agent_fail | Machine passed but early agent professional review rejected. | Yes, high-value negative candidate |
| 9 | pending_owner_review | Waiting for owner judgment. | No |
| 10 | reference_rule_only | Rule/reference text only, not pixel training. | No image training |
| 11 | blocked_unlicensed | Cannot use. | No |
| 12 | positive_complete_runtime_frame | Complete RuntimeFrame candidate satisfies map grammar, playability, and visual review. | Yes, high-value full-frame positive |
| 13 | negative_missing_map_grammar | Candidate has visual material but lacks complete map grammar. | Yes, full-frame negative |
| 14 | negative_missing_spatial_contract | Candidate cannot bind visual regions to walkable, collision, or interaction layers. | Yes, structure negative |
| 15 | negative_director_task_gap | Generation task failed because director inputs or fix hints were incomplete. | Yes, task-level negative |
| 16 | negative_live_state_mismatch | Candidate does not preserve world identity, tick binding, or state continuity. | Yes, runtime negative |

## 9. 当前缺口

| 缺口 | 说明 | 处理方式 |
| --- | --- | --- |
| owner approval | 当前仍是 draft，不是项目所有者最终验收版本 | 需要你人工审核 |
| runtime integration | 字典已经可导出，但还没有全部接入实际导演和训练代码 | 下一步在程序层读取单一地图 generation-task 字段 |
| model quality | 小模型还不能稳定产出专业完整单一地图 | 用完整作画任务包和失败码闭环训练 |

## 10. 下一步计划

| 顺序 | 任务 |
| --- | --- |
| 1 | 把单一地图字典接入程序训练流程和 /ai-painter-progress 展示 |
| 2 | 让每次小模型推理自动保存 task package、director plan、runtime binding、review record、failure codes |
| 3 | 重新启动单一地图训练/生成/审核闭环 
