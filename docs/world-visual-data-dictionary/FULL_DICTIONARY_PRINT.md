# AI-PET-WORLD 世界视觉数据字典完整打印版

更新时间：2026-07-11 13:18:45 +08:00

状态：historical-read-only-world-visual-dictionary-export
GeneratedAt: 2026-07-11T05:17:54.999Z

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

> 本文件是2026-07-11生成的历史打印快照，不是当前审核、训练或发布规则。其中`owner_*`标签和“项目所有者最终验收”描述只用于解释旧记录；当前资格必须按AI Painter正式主体规格、训练数据与来源规则以及审核与存储规格，由机器审核、数据版本和能力版本机器发布身份表达。程序不得从本历史打印版创建新的Owner等待状态。

## 1. 文档目录

| 序号 | 目录 | 条目数 |
| --- | --- | --- |
| 1 | art-direction/ | 1 |
| 2 | baseline/ | 1 |
| 3 | composition/ | 4 |
| 4 | composition-recipe/ | 2 |
| 5 | database/ | 2 |
| 6 | director/ | 3 |
| 7 | drawing-method/ | 1 |
| 8 | ecology/ | 2 |
| 9 | gameplay/ | 1 |
| 10 | generation-task/ | 3 |
| 11 | map-grammar/ | 3 |
| 12 | map-structure/ | 8 |
| 13 | material-recipe/ | 3 |
| 14 | objects/ | 9 |
| 15 | quality-rubric/ | 1 |
| 16 | render-layer-recipe/ | 2 |
| 17 | review/ | 5 |
| 18 | runtime-state/ | 2 |
| 19 | schema/ | 2 |
| 20 | spatial-grid/ | 3 |
| 21 | terrain/ | 8 |
| 22 | training/ | 5 |
| 23 | transition/ | 3 |
| 24 | versions/ | 2 |
| 25 | visual-style/ | 6 |
| 26 | world-ontology/ | 2 |

## 2. 总览

| 项目 | 数量 |
| --- | --- |
| 文档数 | 2 |
| 字典条目 | 84 |
| 分类数 | 26 |
| 注册失败码 | 366 |
| Hard Failure | 345 |
| 未注册 Hard Failure | 0 |
| 训练标签 | 16 |
| 缺失分类 | 0 |

## 3. 出图状态字段

| 状态项 | 内容 |
| --- | --- |
| 字典状态 | dictionary_draw_ready |
| 含义 | The dictionary contains the minimum structured fields to build a complete-map candidate generation task. This is not training-data sufficiency and not owner approval. |
| 字典版本 | mvp-natural-home-v0.3 |
| 注意 | dictionary_draw_ready 只代表可以组织完整候选图生成任务，不代表训练数据足够，不代表项目所有者验收通过。 |

## 4. 完整地图出图绑定

| 模块 | 绑定条目 |
| --- | --- |
| 画布合同 | spatial-grid/complete-map-canvas-contract |
| 地图模板 | map-grammar/natural-home-complete-map-template |
| 渲染层级 | render-layer-recipe/complete-map-layer-stack-v2 |
| 材质 Token | material-recipe/complete-map-material-token-library |
| 物体摆放 | objects/complete-map-object-placement-library |
| 过渡方案 | transition/grass-to-path, transition/grass-to-water, transition/object-to-ground |
| 生成合同 | generation-task/complete-map-image-generation-contract |
| 审核门槛 | review/complete-map-drawability-gate |

## 5. 分类详细内容

### art-direction/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| art-direction/professional-game-art-direction | art-direction | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#art-direction/professional-game-art-direction | Type: art-direction Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| art-direction/professional-game-art-direction | art_direction_missing | Frame has no stable professional game art direction. |
| art-direction/professional-game-art-direction | not_player_facing_art | Frame looks like training output or debug preview, not a player-facing map. |
| art-direction/professional-game-art-direction | style_family_mixed | Terrain, objects or water belong to conflicting art styles. |
| art-direction/professional-game-art-direction | gameplay_read_not_supported | Art direction does not support route, movement or interaction readability. |
| art-direction/professional-game-art-direction | detail_density_unprofessional | Detail density is either empty, noisy, or uncontrolled. |

### baseline/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| baseline/earth | world baseline | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#baseline/earth | Type: world baseline Version: v0.1 The first AI-PET-WORLD natural home uses Earth-like natural logic. This does |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| baseline/earth | floating_object | Object appears pasted without ground contact. |
| baseline/earth | mixed_world_physics | Some elements behave like icons, others like 3D objects, breaking world consistency. |
| baseline/earth | non_earth_visual_logic | Water, soil, plant or stone no longer reads as Earth-like natural material. |

### composition/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| composition/complete-map-professional-readability-v2 | composition | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#composition/complete-map-professional-readability-v2 | Type: composition Version: v0.2 Updated: 2026-07-09 18:58:03 +08:00 |
| composition/layer-order | composition rule | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#composition/layer-order | Type: composition rule Version: v0.1 The first world map must be composed in readable game layers. A professional |
| composition/map-readability | composition rule | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#composition/map-readability | Type: composition rule Version: v0.1 The map must read as a playable world before it reads as a painting. This means |
| composition/professional-quality | composition rule | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#composition/professional-quality | Type: composition rule Version: v0.1 This file defines the first human-level visual bar. It is stricter than the |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| composition/complete-map-professional-readability-v2 | professional_readability_failed | Complete map cannot be read as a professional game screen. |
| composition/complete-map-professional-readability-v2 | route_readability_failed | Player route is unclear or visually broken. |
| composition/complete-map-professional-readability-v2 | land_water_readability_failed | Land and water roles are unclear. |
| composition/complete-map-professional-readability-v2 | object_hierarchy_failed | Objects dominate or disrupt the map structure. |
| composition/complete-map-professional-readability-v2 | scale_coherence_failed | Materials and objects use conflicting scales. |
| composition/complete-map-professional-readability-v2 | palette_coherence_failed | Color groups do not belong to one scene. |
| composition/complete-map-professional-readability-v2 | artifact_suppression_failed | Obvious generation artifacts remain visible. |
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

### composition-recipe/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| composition-recipe/game-map-composition-recipe | composition-recipe | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#composition-recipe/game-map-composition-recipe | Type: composition-recipe Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |
| composition-recipe/single-map-composition-fields | composition-recipe | v0.2 | active draft scope for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#composition-recipe/single-map-composition-fields | Type: composition-recipe Version: v0.2 Updated: 2026-07-08 14:03:25 +08:00 |

| 条目 | 失败码 | 含义 |
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

### database/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| database/schema-draft | database schema draft | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#database/schema-draft | Type: database schema draft Version: v0.1 Updated: 2026-07-08 12:52:59 +08:00 |
| database/storage-plan | database plan | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#database/storage-plan | Type: database plan Version: v0.1 Updated: 2026-07-08 12:52:59 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| database/storage-plan | db_without_versioning | Database stores mutable rules without version identity. |
| database/storage-plan | db_review_not_linked | Review records are not linked to dictionary version and model checkpoint. |
| database/storage-plan | db_binary_blob_first | Database stores large images directly before asset/file storage is planned. |
| database/storage-plan | docs_db_diverge | Documents and database disagree without a migration/export record. |

### director/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| director/complete-map-layout-constraints | director | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#director/complete-map-layout-constraints | Type: director Version: v0.2 Updated: 2026-07-09 18:58:03 +08:00 |
| director/director-contract | director | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#director/director-contract | Type: director Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| director/director-output-schema | director | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#director/director-output-schema | Type: director Version: v0.2 Updated: 2026-07-08 14:15:32 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| director/complete-map-layout-constraints | director_plan_missing | Complete-map generation has no director plan. |
| director/complete-map-layout-constraints | map_reads_as_material_sheet | The output reads as a material test sheet instead of a game map. |
| director/complete-map-layout-constraints | terrain_ratio_uncontrolled | Grass, water, path and object ratios are not controlled. |
| director/complete-map-layout-constraints | route_intent_missing | The path has no readable walkable purpose. |
| director/complete-map-layout-constraints | water_intent_missing | Water is decorative noise instead of a coherent map region. |
| director/complete-map-layout-constraints | negative_space_destroyed | Details occupy the map so heavily that playable space cannot be read. |
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

### drawing-method/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| drawing-method/ai-drawing-process | drawing-method | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#drawing-method/ai-drawing-process | Type: drawing-method Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| drawing-method/ai-drawing-process | missing_drawing_process | Generation did not store the drawing-process data. |
| drawing-method/ai-drawing-process | skipped_spatial_blockout | Image jumped into texture/detail without a readable layout blockout. |
| drawing-method/ai-drawing-process | skipped_value_grouping | Image has materials but no readable light/dark structure. |
| drawing-method/ai-drawing-process | skipped_grounding_pass | Objects and edges were not integrated into terrain. |
| drawing-method/ai-drawing-process | polish_without_structure | Image has detail but lacks professional map structure. |

### ecology/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| ecology/ecology-state-rules | ecology | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#ecology/ecology-state-rules | Type: ecology Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| ecology/single-map-ecology-fields | ecology | v0.2 | active draft scope for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#ecology/single-map-ecology-fields | Type: ecology Version: v0.2 Updated: 2026-07-08 14:03:25 +08:00 |

| 条目 | 失败码 | 含义 |
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

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| gameplay/playability-contract | gameplay | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#gameplay/playability-contract | Type: gameplay Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| gameplay/playability-contract | no_playable_read | The image looks decorative but not playable. |
| gameplay/playability-contract | movement_affordance_missing | Player cannot infer where movement is possible. |
| gameplay/playability-contract | collision_affordance_missing | Blocked areas are not visually explained. |
| gameplay/playability-contract | interaction_cue_noise | Too many decorative details compete with future interaction points. |
| gameplay/playability-contract | player_scale_conflict | Path, objects, and open areas imply incompatible player scale. |

### generation-task/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| generation-task/complete-map-image-generation-contract | generation-task | v0.3 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#generation-task/complete-map-image-generation-contract | Type: generation-task Version: v0.3 Updated: 2026-07-09 19:24:00 +08:00 |
| generation-task/runtime-frame-generation-task | generation-task | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#generation-task/runtime-frame-generation-task | Type: generation-task Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| generation-task/task-package-schema | generation-task | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#generation-task/task-package-schema | Type: generation-task Version: v0.2 Updated: 2026-07-08 14:15:32 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| generation-task/complete-map-image-generation-contract | generation_contract_missing | Complete-map generation lacks the required draw-ready package. |
| generation-task/complete-map-image-generation-contract | canvas_contract_missing | Generation task has no canvas or camera contract. |
| generation-task/complete-map-image-generation-contract | material_plan_missing | Generation task has no explicit material plan. |
| generation-task/complete-map-image-generation-contract | object_plan_missing | Generation task has no object placement plan. |
| generation-task/complete-map-image-generation-contract | transition_plan_missing | Generation task has no transition plan. |
| generation-task/complete-map-image-generation-contract | negative_constraints_missing | Generation task has no explicit failure constraints. |
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

### map-grammar/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| map-grammar/complete-map-grammar | map-grammar | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-grammar/complete-map-grammar | Type: map-grammar Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| map-grammar/map-part-schema | map-grammar | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-grammar/map-part-schema | Type: map-grammar Version: v0.2 Updated: 2026-07-08 13:11:42 +08:00 |
| map-grammar/natural-home-complete-map-template | map-grammar | v0.3 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-grammar/natural-home-complete-map-template | Type: map-grammar Version: v0.3 Updated: 2026-07-09 19:24:00 +08:00 |

| 条目 | 失败码 | 含义 |
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
| map-grammar/natural-home-complete-map-template | complete_map_template_missing | Generation has no complete-map spatial template. |
| map-grammar/natural-home-complete-map-template | grass_land_ratio_failed | Grass and walkable land are too low or too dominant. |
| map-grammar/natural-home-complete-map-template | water_region_fragmented | Water appears as scattered fragments instead of a coherent region. |
| map-grammar/natural-home-complete-map-template | path_region_purposeless | Path exists but does not connect meaningful map areas. |
| map-grammar/natural-home-complete-map-template | center_space_unreadable | Center or resting space cannot be read. |
| map-grammar/natural-home-complete-map-template | decoration_ratio_excessive | Small details dominate the complete map. |

### map-structure/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| map-structure/branch-path | map structure | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-structure/branch-path | Type: map structure World meaning: secondary route Version: v0.1 |
| map-structure/collision-area | map structure | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-structure/collision-area | Type: map structure World meaning: non-walkable or blocking area Version: v0.1 |
| map-structure/entrance | map structure | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-structure/entrance | Type: map structure World meaning: player entry point Version: v0.1 |
| map-structure/home-center | map structure | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-structure/home-center | Type: map structure World meaning: natural home center, visual organization point Version: v0.1 |
| map-structure/main-path | map structure | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-structure/main-path | Type: map structure World meaning: primary walkable route Version: v0.1 |
| map-structure/natural-boundary | map structure | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-structure/natural-boundary | Type: map structure World meaning: natural edge of playable map Version: v0.1 |
| map-structure/walkable-area | map structure | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-structure/walkable-area | Type: map structure World meaning: area where player can move Version: v0.1 |
| map-structure/water-edge-zone | map structure | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#map-structure/water-edge-zone | Type: map structure World meaning: playable/readable area around water boundary Version: v0.1 |

| 条目 | 失败码 | 含义 |
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

### material-recipe/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| material-recipe/complete-map-material-token-library | material-recipe | v0.3 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#material-recipe/complete-map-material-token-library | Type: material-recipe Version: v0.3 Updated: 2026-07-09 19:24:00 +08:00 |
| material-recipe/natural-home-material-recipes | material-recipe | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#material-recipe/natural-home-material-recipes | Type: material-recipe Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |
| material-recipe/single-map-material-field-schema | material-recipe | v0.2 | active draft scope for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#material-recipe/single-map-material-field-schema | Type: material-recipe Version: v0.2 Updated: 2026-07-08 14:03:25 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| material-recipe/complete-map-material-token-library | material_token_missing | Required material is not declared. |
| material-recipe/complete-map-material-token-library | material_token_role_conflict | One token is used for incompatible roles. |
| material-recipe/complete-map-material-token-library | material_palette_out_of_family | Material color does not belong to natural-home palette. |
| material-recipe/complete-map-material-token-library | material_texture_scale_mismatch | Material texture scale conflicts with map scale. |
| material-recipe/complete-map-material-token-library | material_contamination_unchecked | Material token has no contamination guard. |
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

### objects/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| objects/berry-bush | object/resource | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/berry-bush | Type: object/resource World meaning: small resource plant Version: v0.1 |
| objects/complete-map-object-placement-library | objects | v0.3 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/complete-map-object-placement-library | Type: objects Version: v0.3 Updated: 2026-07-09 19:24:00 +08:00 |
| objects/flower | object/detail | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/flower | Type: object/detail World meaning: small natural decoration Version: v0.1 |
| objects/grass-detail | object/detail | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/grass-detail | Type: object/detail World meaning: small non-interactive surface detail Version: v0.1 |
| objects/pebble | object/detail | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/pebble | Type: object/detail World meaning: small stone detail Version: v0.1 |
| objects/reed | object/detail | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/reed | Type: object/detail World meaning: shoreline vegetation Version: v0.1 |
| objects/rock | object | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/rock | Type: object World meaning: stone obstacle or decoration Version: v0.1 |
| objects/shrub | object | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/shrub | Type: object World meaning: low vegetation, soft boundary, decoration Version: v0.1 |
| objects/tree | object | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#objects/tree | Type: object World meaning: plant, obstacle, boundary, ecology signal Version: v0.1 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| objects/berry-bush | indistinct_resource | Cannot distinguish from random grass noise. |
| objects/berry-bush | floating_resource | No ground contact. |
| objects/berry-bush | excessive_bright_berries | Berry accents become noisy bright pixels. |
| objects/complete-map-object-placement-library | object_placement_library_missing | Generation has no object placement library. |
| objects/complete-map-object-placement-library | object_density_uncontrolled | Object counts are uncontrolled. |
| objects/complete-map-object-placement-library | object_blocks_main_route | Object blocks or hides the main route. |
| objects/complete-map-object-placement-library | shoreline_object_inland | Shoreline object appears far from water without purpose. |
| objects/complete-map-object-placement-library | object_anchor_missing | Object is not anchored to terrain. |
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

### quality-rubric/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| quality-rubric/professional-map-quality-rubric | quality-rubric | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#quality-rubric/professional-map-quality-rubric | Type: quality-rubric Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| quality-rubric/professional-map-quality-rubric | quality_rubric_missing | Review did not use the professional map quality rubric. |
| quality-rubric/professional-map-quality-rubric | quality_score_unstructured | Review result lacks category scores and structured failure codes. |
| quality-rubric/professional-map-quality-rubric | machine_score_overrides_owner | Machine score incorrectly overrides owner rejection. |
| quality-rubric/professional-map-quality-rubric | near_pass_without_fix_targets | Near-pass frame lacks next repair targets. |
| quality-rubric/professional-map-quality-rubric | professional_score_below_gate | Frame score is below professional display gate. |

### render-layer-recipe/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| render-layer-recipe/complete-map-layer-stack-v2 | render-layer-recipe | v0.3 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#render-layer-recipe/complete-map-layer-stack-v2 | Type: render-layer-recipe Version: v0.3 Updated: 2026-07-09 19:24:00 +08:00 |
| render-layer-recipe/runtime-render-layer-recipe | render-layer-recipe | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#render-layer-recipe/runtime-render-layer-recipe | Type: render-layer-recipe Version: v0.2 Updated: 2026-07-08 13:37:48 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| render-layer-recipe/complete-map-layer-stack-v2 | layer_stack_missing | Complete-map generation has no layer order. |
| render-layer-recipe/complete-map-layer-stack-v2 | transition_layer_after_detail | Details are drawn before transitions and break edges. |
| render-layer-recipe/complete-map-layer-stack-v2 | object_contact_layer_missing | Objects lack a grounding/contact layer. |
| render-layer-recipe/complete-map-layer-stack-v2 | final_unifying_pass_missing | Output lacks final palette and artifact integration. |
| render-layer-recipe/complete-map-layer-stack-v2 | detail_layer_blocks_playability | Detail layer hides route, water boundary or center. |
| render-layer-recipe/runtime-render-layer-recipe | render_layer_recipe_missing | Generation or compositor lacks render layer recipe. |
| render-layer-recipe/runtime-render-layer-recipe | render_layer_order_broken | Layers are composed in an order that breaks readability. |
| render-layer-recipe/runtime-render-layer-recipe | route_occluded_by_detail | Main route is hidden by details or objects. |
| render-layer-recipe/runtime-render-layer-recipe | center_occluded_by_detail | Home center is hidden by texture or objects. |
| render-layer-recipe/runtime-render-layer-recipe | object_without_contact_layer | Object appears without footprint/contact layer. |
| render-layer-recipe/runtime-render-layer-recipe | debug_layer_visible | Debug/fallback/program layer is visible as final game art. |

### review/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| review/acceptance | review dictionary | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#review/acceptance | Type: review dictionary Version: v0.1 Updated: 2026-07-08 14:03:25 +08:00 |
| review/complete-map-drawability-gate | review | v0.3 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#review/complete-map-drawability-gate | Type: review Version: v0.3 Updated: 2026-07-09 19:24:00 +08:00 |
| review/complete-map-negative-sample-routing | review | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#review/complete-map-negative-sample-routing | Type: review Version: v0.2 Updated: 2026-07-09 18:58:03 +08:00 |
| review/failure-codes | review dictionary | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#review/failure-codes | Type: review dictionary Version: v0.1 Updated: 2026-07-08 14:26:44 +08:00 |
| review/single-map-visual-acceptance | review dictionary | v0.2 | active draft scope for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#review/single-map-visual-acceptance | Type: review dictionary Version: v0.2 Updated: 2026-07-08 14:03:25 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| review/complete-map-drawability-gate | drawability_gate_missing | No drawability gate exists before generation. |
| review/complete-map-drawability-gate | drawability_canvas_failed | Canvas information is insufficient. |
| review/complete-map-drawability-gate | drawability_materials_failed | Material tokens are insufficient. |
| review/complete-map-drawability-gate | drawability_objects_failed | Object placement data is insufficient. |
| review/complete-map-drawability-gate | drawability_transitions_failed | Transition definitions are insufficient. |
| review/complete-map-drawability-gate | drawability_review_failed | Review fields are insufficient. |
| review/complete-map-negative-sample-routing | rejected_frame_not_routed | Failed complete frame was not routed to negative samples. |
| review/complete-map-negative-sample-routing | failure_code_missing | Negative sample lacks structured failure code. |
| review/complete-map-negative-sample-routing | failure_region_missing | Negative sample lacks full-frame or crop evidence. |
| review/complete-map-negative-sample-routing | next_training_target_missing | Failure cannot inform the next training round. |
| review/complete-map-negative-sample-routing | judge_gap_not_recorded | Machine pass and owner reject gap was not retained. |
| review/single-map-visual-acceptance | single_map_acceptance_missing | Review did not use the current single-map acceptance standard. |
| review/single-map-visual-acceptance | single_map_scope_failed | Candidate is not one complete map visual. |
| review/single-map-visual-acceptance | reserved_player_gate_used | Review used player-character requirements in current scope. |
| review/single-map-visual-acceptance | reserved_interaction_gate_used | Review used interaction mechanics in current scope. |
| review/single-map-visual-acceptance | reserved_dynamic_gate_used | Review used multi-tick dynamic variation in current scope. |

### runtime-state/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| runtime-state/live-map-state | runtime-state | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#runtime-state/live-map-state | Type: runtime-state Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| runtime-state/runtime-frame-state-binding-schema | runtime-state | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#runtime-state/runtime-frame-state-binding-schema | Type: runtime-state Version: v0.2 Updated: 2026-07-08 13:53:29 +08:00 |

| 条目 | 失败码 | 含义 |
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

### schema/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| schema/dictionary-entry | schema | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#schema/dictionary-entry | Type: schema Version: v0.1 Every visual dictionary item should follow a stable shape so code, local model |
| schema/review-record | schema | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#schema/review-record | Type: schema Version: v0.1 Every model inference, generated map, failed frame and accepted frame must be |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| schema/dictionary-entry | missing_required_field | Dictionary item cannot be used by automation. |
| schema/dictionary-entry | duplicate_meaning | Two files define the same object or rule with different names. |
| schema/dictionary-entry | vague_name | Name does not reveal the object or rule directly. |
| schema/review-record | missing_image_path | Review record cannot prove what was judged. |
| schema/review-record | missing_failure_codes | Failed sample cannot train the model. |
| schema/review-record | manual_only_memory | Result exists only in conversation and not in project data. |

### spatial-grid/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| spatial-grid/complete-map-canvas-contract | spatial-grid | v0.3 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#spatial-grid/complete-map-canvas-contract | Type: spatial-grid Version: v0.3 Updated: 2026-07-09 19:24:00 +08:00 |
| spatial-grid/grid-and-layer-contract | spatial-grid | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#spatial-grid/grid-and-layer-contract | Type: spatial-grid Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| spatial-grid/layer-record-schema | spatial-grid | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#spatial-grid/layer-record-schema | Type: spatial-grid Version: v0.2 Updated: 2026-07-08 13:11:42 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| spatial-grid/complete-map-canvas-contract | canvas_size_missing | Sample lacks canvas size. |
| spatial-grid/complete-map-canvas-contract | source_scale_missing | Crop or model output lacks source scale metadata. |
| spatial-grid/complete-map-canvas-contract | crop_source_missing | Crop cannot be traced to full image. |
| spatial-grid/complete-map-canvas-contract | camera_contract_mismatch | Object and terrain camera assumptions conflict. |
| spatial-grid/complete-map-canvas-contract | review_region_unaddressable | Review failure region cannot be mapped back to image coordinates. |
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

### terrain/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| terrain/dirt-path | terrain | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#terrain/dirt-path | Type: terrain World meaning: walkable earth path connecting important areas Version: v0.1 |
| terrain/forest-edge | terrain boundary | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#terrain/forest-edge | Type: terrain boundary World meaning: natural map boundary and dense vegetation edge Version: v0.1 |
| terrain/grass | terrain | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#terrain/grass | Type: terrain World meaning: ordinary walkable natural grassland Version: v0.1 |
| terrain/grass-purity-and-variation | terrain | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#terrain/grass-purity-and-variation | Type: terrain Version: v0.2 Updated: 2026-07-09 18:58:03 +08:00 |
| terrain/mud-patch | terrain detail | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#terrain/mud-patch | Type: terrain detail World meaning: damp exposed soil Version: v0.1 |
| terrain/shoreline | terrain transition | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#terrain/shoreline | Type: terrain transition World meaning: natural boundary between land and water Version: v0.1 |
| terrain/tall-grass | terrain | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#terrain/tall-grass | Type: terrain World meaning: denser grass, edge vegetation, soft obstacle hint Version: v0.1 |
| terrain/water | terrain | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#terrain/water | Type: terrain World meaning: natural water body Version: v0.1 |

| 条目 | 失败码 | 含义 |
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
| terrain/grass-purity-and-variation | grass_slot_contaminated_by_water | Blue water fragments appear inside grass material. |
| terrain/grass-purity-and-variation | grass_slot_contaminated_by_path | Path, sand or dirt fragments appear inside grass material. |
| terrain/grass-purity-and-variation | grass_slot_contaminated_by_object | Rock, tree, leaf cluster or object fragments appear inside grass material. |
| terrain/grass-purity-and-variation | grass_texture_random_noise | Grass is noisy without terrain organization. |
| terrain/grass-purity-and-variation | grass_texture_flat_fill | Grass is a flat color field with no professional surface depth. |
| terrain/grass-purity-and-variation | grass_tile_grid_visible | Grass repeats as an obvious grid or stamp pattern. |
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

### training/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| training/automatic-storage | training rule | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#training/automatic-storage | Type: training rule Version: v0.1 The local program, not Codex memory, must store every important training and |
| training/complete-map-dataset-readiness | training | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#training/complete-map-dataset-readiness | Type: training Version: v0.2 Updated: 2026-07-09 18:58:03 +08:00 |
| training/complete-map-drawability-readiness | training | v0.3 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#training/complete-map-drawability-readiness | Type: training Version: v0.3 Updated: 2026-07-09 19:24:00 +08:00 |
| training/feedback-loop | training dictionary | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#training/feedback-loop | Type: training dictionary Version: v0.1 The model must learn from both technical failures and owner visual failures. |
| training/sample-labels | training dictionary | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#training/sample-labels | Type: training dictionary Version: v0.1 Updated: 2026-07-08 12:52:59 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| training/automatic-storage | inference_not_saved | Model output was generated but not stored. |
| training/automatic-storage | review_not_saved | Review happened but cannot be found in project records. |
| training/automatic-storage | no_negative_memory | Failed outputs are not available for future training. |
| training/automatic-storage | unstored_training_content | Training content is visible or discussed but has no stored record. |
| training/automatic-storage | page_bypasses_storage | Page shows training content without reading the stored record first. |
| training/complete-map-dataset-readiness | dataset_package_missing_dictionary_snapshot | Dataset package is not bound to a dictionary version. |
| training/complete-map-dataset-readiness | dataset_package_missing_director_plan | Dataset package is not bound to director constraints. |
| training/complete-map-dataset-readiness | dataset_package_missing_negative_labels | Negative samples exist but cannot be learned from. |
| training/complete-map-dataset-readiness | dataset_package_missing_transition_labels | Transition samples exist but are not labeled. |
| training/complete-map-dataset-readiness | dataset_package_pretends_approved | Dataset claims approved training readiness without owner-approved positives. |
| training/complete-map-drawability-readiness | draw_ready_confused_with_training_ready | Candidate draw readiness was mistaken for final training readiness. |
| training/complete-map-drawability-readiness | task_binding_missing_dictionary_version | Task package does not bind dictionary version. |
| training/complete-map-drawability-readiness | task_binding_missing_canvas_contract | Task package does not bind canvas contract. |
| training/complete-map-drawability-readiness | task_binding_missing_map_template | Task package does not bind complete-map template. |
| training/complete-map-drawability-readiness | task_binding_missing_drawability_gate | Task package does not bind drawability gate. |

### transition/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| transition/grass-to-path | transition | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#transition/grass-to-path | Type: transition Version: v0.2 Updated: 2026-07-09 18:58:03 +08:00 |
| transition/grass-to-water | transition | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#transition/grass-to-water | Type: transition Version: v0.2 Updated: 2026-07-09 18:58:03 +08:00 |
| transition/object-to-ground | transition | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#transition/object-to-ground | Type: transition Version: v0.2 Updated: 2026-07-09 18:58:03 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| transition/grass-to-path | grass_to_path_transition_missing | Path and grass meet without any transition. |
| transition/grass-to-path | path_overlay_tape | Path looks pasted as tape. |
| transition/grass-to-path | path_edge_hard_cut | Path edge is unnaturally hard. |
| transition/grass-to-path | path_scale_unreadable | The path is too wide, too narrow, or unclear as a route. |
| transition/grass-to-water | grass_to_water_transition_missing | Land and water meet without shore material. |
| transition/grass-to-water | shoreline_hard_cut | Shore edge is an unnatural hard cut. |
| transition/grass-to-water | water_texture_leaks_to_grass | Water contaminates grass material. |
| transition/grass-to-water | grass_texture_leaks_to_water | Grass contaminates water material. |
| transition/grass-to-water | water_depth_unreadable | Water has no readable shallow-to-deep structure. |
| transition/object-to-ground | object_ground_transition_missing | Object appears without ground integration. |
| transition/object-to-ground | floating_object | Object appears floating or pasted. |
| transition/object-to-ground | sticker_cutout_object | Object edge reads like a sticker. |
| transition/object-to-ground | object_scale_mismatch | Object scale breaks the map. |
| transition/object-to-ground | object_lighting_mismatch | Object lighting conflicts with the ground. |

### versions/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| versions/current-single-map-visual-scope | version boundary | v0.2 | active draft scope for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#versions/current-single-map-visual-scope | Type: version boundary Version: v0.2 Updated: 2026-07-08 13:58:07 +08:00 |
| versions/mvp-natural-home | version boundary | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#versions/mvp-natural-home | Type: version boundary Version: v0.1 Updated: 2026-07-08 13:58:07 +08:00 |

| 条目 | 失败码 | 含义 |
| --- | --- | --- |
| versions/current-single-map-visual-scope | active_scope_player_feature_leak | Current single-map visual task includes player-character requirements. |
| versions/current-single-map-visual-scope | active_scope_interaction_feature_leak | Current single-map visual task includes click, collect, build or inspect requirements. |
| versions/current-single-map-visual-scope | active_scope_gameplay_gate_used | Current review fails or passes based on gameplay systems outside current scope. |
| versions/current-single-map-visual-scope | active_scope_dynamic_tick_required | Current review requires multi-tick visual variation outside current scope. |
| versions/mvp-natural-home | partial_candidate_not_full_world | Candidate has useful local quality, but it is not a complete first playable world map. |
| versions/mvp-natural-home | missing_complete_map_structure | Image does not show the full entrance/path/center/water/boundary composition. |
| versions/mvp-natural-home | active_scope_player_feature_leak | Current single-map visual task includes player-character requirements. |
| versions/mvp-natural-home | active_scope_interaction_feature_leak | Current single-map visual task includes click, collect, build or inspect requirements. |

### visual-style/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| visual-style/camera | visual style | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#visual-style/camera | Type: visual style Version: v0.1 The first map must use one camera language. |
| visual-style/color | visual style | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#visual-style/color | Type: visual style Version: v0.1 Colors should be natural, readable and game-like. |
| visual-style/edge-treatment | visual style | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#visual-style/edge-treatment | Type: visual style Version: v0.1 Edges must explain natural transitions. |
| visual-style/light | visual style | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#visual-style/light | Type: visual style Version: v0.1 Lighting should make the world unified and readable. |
| visual-style/material-density | visual style | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#visual-style/material-density | Type: visual style Version: v0.1 Material detail must be layered and controlled. |
| visual-style/object-grounding | visual style | v0.1 |  | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#visual-style/object-grounding | Type: visual style Version: v0.1 Object grounding is mandatory. Any object that feels pasted or floating fails. |

| 条目 | 失败码 | 含义 |
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

### world-ontology/

| ID | 类型 | 版本 | 状态 | 来源 | 摘要 |
| --- | --- | --- | --- | --- | --- |
| world-ontology/entity-taxonomy | world-ontology | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#world-ontology/entity-taxonomy | Type: world-ontology Version: v0.2 Updated: 2026-07-08 12:52:59 +08:00 |
| world-ontology/world-entity-record-schema | world-ontology | v0.2 | draft for owner review | data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json#world-ontology/world-entity-record-schema | Type: world-ontology Version: v0.2 Updated: 2026-07-08 13:53:29 +08:00 |

| 条目 | 失败码 | 含义 |
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

## 6. 注册失败码总表

| 序号 | 失败码 | 含义 | 典型修复目标 |
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
| 282 | artifact_suppression_failed | Obvious generation artifacts remain visible in a complete map. | `composition/complete-map-professional-readability-v2.md` |
| 283 | dataset_package_missing_dictionary_snapshot | Dataset package is not bound to a dictionary snapshot. | `training/complete-map-dataset-readiness.md` |
| 284 | dataset_package_missing_director_plan | Dataset package is not bound to director constraints. | `training/complete-map-dataset-readiness.md` |
| 285 | dataset_package_missing_negative_labels | Negative samples exist but lack learnable labels. | `training/complete-map-dataset-readiness.md` |
| 286 | dataset_package_missing_transition_labels | Transition samples exist but lack structured labels. | `training/complete-map-dataset-readiness.md` |
| 287 | dataset_package_pretends_approved | Dataset claims approval without owner-approved complete-map positives. | `training/complete-map-dataset-readiness.md` |
| 288 | director_plan_missing | Complete-map generation has no director plan. | `director/complete-map-layout-constraints.md` |
| 289 | failure_code_missing | Negative sample lacks a registered failure code. | `review/complete-map-negative-sample-routing.md` |
| 290 | failure_region_missing | Negative sample lacks full-frame or crop evidence. | `review/complete-map-negative-sample-routing.md` |
| 291 | grass_slot_contaminated_by_object | Object fragments appear inside grass material. | `terrain/grass-purity-and-variation.md` |
| 292 | grass_slot_contaminated_by_path | Path or dirt fragments appear inside grass material. | `terrain/grass-purity-and-variation.md` |
| 293 | grass_slot_contaminated_by_water | Water fragments appear inside grass material. | `terrain/grass-purity-and-variation.md` |
| 294 | grass_texture_flat_fill | Grass is flat and has no professional surface depth. | `terrain/grass-purity-and-variation.md` |
| 295 | grass_texture_leaks_to_water | Grass pattern appears inside open water. | `transition/grass-to-water.md` |
| 296 | grass_texture_random_noise | Grass is noisy without terrain organization. | `terrain/grass-purity-and-variation.md` |
| 297 | grass_tile_grid_visible | Grass repeats as an obvious tile grid. | `terrain/grass-purity-and-variation.md` |
| 298 | grass_to_path_transition_missing | Path and grass meet without terrain transition. | `transition/grass-to-path.md` |
| 299 | grass_to_water_transition_missing | Land and water meet without shore transition. | `transition/grass-to-water.md` |
| 300 | judge_gap_not_recorded | Machine pass and owner rejection gap was not retained. | `review/complete-map-negative-sample-routing.md` |
| 301 | land_water_readability_failed | Land and water roles are unclear. | `composition/complete-map-professional-readability-v2.md` |
| 302 | map_reads_as_material_sheet | Output reads as a material test sheet instead of a game map. | `director/complete-map-layout-constraints.md` |
| 303 | negative_space_destroyed | Details destroy readable playable space. | `director/complete-map-layout-constraints.md` |
| 304 | next_training_target_missing | Failure cannot inform the next training round. | `review/complete-map-negative-sample-routing.md` |
| 305 | object_ground_transition_missing | Object appears without ground integration. | `transition/object-to-ground.md` |
| 306 | object_hierarchy_failed | Objects dominate or disrupt the map structure. | `composition/complete-map-professional-readability-v2.md` |
| 307 | object_lighting_mismatch | Object lighting conflicts with the ground. | `transition/object-to-ground.md` |
| 308 | object_scale_mismatch | Object scale breaks the map. | `transition/object-to-ground.md` |
| 309 | palette_coherence_failed | Color groups do not belong to one scene. | `composition/complete-map-professional-readability-v2.md` |
| 310 | path_edge_hard_cut | Path edge is unnaturally hard. | `transition/grass-to-path.md` |
| 311 | path_overlay_tape | Path looks pasted as tape. | `transition/grass-to-path.md` |
| 312 | path_scale_unreadable | Path scale is too wide, too narrow, or unclear as a route. | `transition/grass-to-path.md` |
| 313 | professional_readability_failed | Complete map cannot be read as a professional game screen. | `composition/complete-map-professional-readability-v2.md` |
| 314 | rejected_frame_not_routed | Failed complete frame was not routed to negative samples. | `review/complete-map-negative-sample-routing.md` |
| 315 | route_intent_missing | Path has no readable walkable purpose. | `director/complete-map-layout-constraints.md` |
| 316 | route_readability_failed | Player route is unclear or visually broken. | `composition/complete-map-professional-readability-v2.md` |
| 317 | scale_coherence_failed | Materials and objects use conflicting scales. | `composition/complete-map-professional-readability-v2.md` |
| 318 | shoreline_hard_cut | Shore edge is an unnatural hard cut. | `transition/grass-to-water.md` |
| 319 | sticker_cutout_object | Object edge reads like a sticker. | `transition/object-to-ground.md` |
| 320 | terrain_ratio_uncontrolled | Grass, water, path and object ratios are not controlled. | `director/complete-map-layout-constraints.md` |
| 321 | water_depth_unreadable | Water has no readable shallow-to-deep structure. | `transition/grass-to-water.md` |
| 322 | water_intent_missing | Water is decorative noise instead of a coherent map region. | `director/complete-map-layout-constraints.md` |
| 323 | water_texture_leaks_to_grass | Water contaminates grass material. | `transition/grass-to-water.md` |
| 324 | camera_contract_mismatch | Object and terrain camera assumptions conflict. | `spatial-grid/complete-map-canvas-contract.md` |
| 325 | canvas_contract_missing | Generation task has no canvas or camera contract. | `generation-task/complete-map-image-generation-contract.md` |
| 326 | canvas_size_missing | Sample lacks canvas size. | `spatial-grid/complete-map-canvas-contract.md` |
| 327 | center_space_unreadable | Center or resting space cannot be read. | `map-grammar/natural-home-complete-map-template.md` |
| 328 | complete_map_template_missing | Generation has no complete-map spatial template. | `map-grammar/natural-home-complete-map-template.md` |
| 329 | crop_source_missing | Crop cannot be traced to full image. | `spatial-grid/complete-map-canvas-contract.md` |
| 330 | decoration_ratio_excessive | Small details dominate the complete map. | `map-grammar/natural-home-complete-map-template.md` |
| 331 | detail_layer_blocks_playability | Detail layer hides route, water boundary or center. | `render-layer-recipe/complete-map-layer-stack-v2.md` |
| 332 | draw_ready_confused_with_training_ready | Candidate draw readiness was mistaken for final training readiness. | `training/complete-map-drawability-readiness.md` |
| 333 | drawability_canvas_failed | Canvas information is insufficient. | `review/complete-map-drawability-gate.md` |
| 334 | drawability_gate_missing | No drawability gate exists before generation. | `review/complete-map-drawability-gate.md` |
| 335 | drawability_materials_failed | Material tokens are insufficient. | `review/complete-map-drawability-gate.md` |
| 336 | drawability_objects_failed | Object placement data is insufficient. | `review/complete-map-drawability-gate.md` |
| 337 | drawability_review_failed | Review fields are insufficient. | `review/complete-map-drawability-gate.md` |
| 338 | drawability_transitions_failed | Transition definitions are insufficient. | `review/complete-map-drawability-gate.md` |
| 339 | final_unifying_pass_missing | Output lacks final palette and artifact integration. | `render-layer-recipe/complete-map-layer-stack-v2.md` |
| 340 | generation_contract_missing | Complete-map generation lacks the required draw-ready package. | `generation-task/complete-map-image-generation-contract.md` |
| 341 | grass_land_ratio_failed | Grass and walkable land are too low or too dominant. | `map-grammar/natural-home-complete-map-template.md` |
| 342 | layer_stack_missing | Complete-map generation has no layer order. | `render-layer-recipe/complete-map-layer-stack-v2.md` |
| 343 | material_contamination_unchecked | Material token has no contamination guard. | `material-recipe/complete-map-material-token-library.md` |
| 344 | material_palette_out_of_family | Material color does not belong to natural-home palette. | `material-recipe/complete-map-material-token-library.md` |
| 345 | material_plan_missing | Generation task has no explicit material plan. | `generation-task/complete-map-image-generation-contract.md` |
| 346 | material_texture_scale_mismatch | Material texture scale conflicts with map scale. | `material-recipe/complete-map-material-token-library.md` |
| 347 | material_token_missing | Required material is not declared. | `material-recipe/complete-map-material-token-library.md` |
| 348 | material_token_role_conflict | One token is used for incompatible roles. | `material-recipe/complete-map-material-token-library.md` |
| 349 | negative_constraints_missing | Generation task has no explicit failure constraints. | `generation-task/complete-map-image-generation-contract.md` |
| 350 | object_anchor_missing | Object is not anchored to terrain. | `objects/complete-map-object-placement-library.md` |
| 351 | object_blocks_main_route | Object blocks or hides the main route. | `objects/complete-map-object-placement-library.md` |
| 352 | object_contact_layer_missing | Objects lack a grounding/contact layer. | `render-layer-recipe/complete-map-layer-stack-v2.md` |
| 353 | object_density_uncontrolled | Object counts are uncontrolled. | `objects/complete-map-object-placement-library.md` |
| 354 | object_plan_missing | Generation task has no object placement plan. | `generation-task/complete-map-image-generation-contract.md` |
| 355 | object_placement_library_missing | Generation has no object placement library. | `objects/complete-map-object-placement-library.md` |
| 356 | path_region_purposeless | Path exists but does not connect meaningful map areas. | `map-grammar/natural-home-complete-map-template.md` |
| 357 | review_region_unaddressable | Review failure region cannot be mapped back to image coordinates. | `spatial-grid/complete-map-canvas-contract.md` |
| 358 | shoreline_object_inland | Shoreline object appears far from water without purpose. | `objects/complete-map-object-placement-library.md` |
| 359 | source_scale_missing | Crop or model output lacks source scale metadata. | `spatial-grid/complete-map-canvas-contract.md` |
| 360 | task_binding_missing_canvas_contract | Task package does not bind canvas contract. | `training/complete-map-drawability-readiness.md` |
| 361 | task_binding_missing_dictionary_version | Task package does not bind dictionary version. | `training/complete-map-drawability-readiness.md` |
| 362 | task_binding_missing_drawability_gate | Task package does not bind drawability gate. | `training/complete-map-drawability-readiness.md` |
| 363 | task_binding_missing_map_template | Task package does not bind complete-map template. | `training/complete-map-drawability-readiness.md` |
| 364 | transition_layer_after_detail | Details are drawn before transitions and break edges. | `render-layer-recipe/complete-map-layer-stack-v2.md` |
| 365 | transition_plan_missing | Generation task has no transition plan. | `generation-task/complete-map-image-generation-contract.md` |
| 366 | water_region_fragmented | Water appears as scattered fragments instead of a coherent region. | `map-grammar/natural-home-complete-map-template.md` |

## 7. 训练标签总表

| 标签 | 含义 | 是否可训练 |
| --- | --- | --- |
| positive_owner_accepted | Owner accepted as matching first-version target. | Yes |
| positive_machine_and_owner_passed | Machine and owner both passed. | Yes |
| positive_local_material_candidate | Local visual quality is useful for material/style training, but not enough for full world approval. | Yes, as local/material positive |
| negative_owner_rejected | Owner rejected visual quality. | Yes, as negative |
| negative_agent_rejected | Early agent professional review rejected visual quality before owner final review. | Yes, as negative candidate |
| negative_machine_failed | Machine failed visual/structure gate. | Yes, as negative |
| negative_machine_pass_owner_fail | Machine passed but owner rejected. | Yes, high-value negative |
| negative_machine_pass_agent_fail | Machine passed but early agent professional review rejected. | Yes, high-value negative candidate |
| pending_owner_review | Waiting for owner judgment. | No |
| reference_rule_only | Rule/reference text only, not pixel training. | No image training |
| blocked_unlicensed | Cannot use. | No |
| positive_complete_runtime_frame | Complete RuntimeFrame candidate satisfies map grammar, playability, and visual review. | Yes, high-value full-frame positive |
| negative_missing_map_grammar | Candidate has visual material but lacks complete map grammar. | Yes, full-frame negative |
| negative_missing_spatial_contract | Candidate cannot bind visual regions to walkable, collision, or interaction layers. | Yes, structure negative |
| negative_director_task_gap | Generation task failed because director inputs or fix hints were incomplete. | Yes, task-level negative |
| negative_live_state_mismatch | Candidate does not preserve world identity, tick binding, or state continuity. | Yes, runtime negative |

## 8. 字典覆盖缺口字段

| 缺口 | 说明 |
| --- | --- |
| 训练数据 | 字典已经具备完整候选图任务字段，但正负样本数量仍需由训练数据审计决定。 |
| 项目验收 | 任何 RuntimeFrame 仍必须经过项目所有者人工最终验收。 |
| 自动生成 | 下一步程序必须读取本字典版本生成候选图，并自动保存任务包、图片、审核记录和失败码。 |
