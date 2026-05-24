# Home System

当前目录负责：家园状态、建设进度与空间实体。

## 当前正式边界

当前 Home System 遵循用户最新三份正式文档：

1. 不默认生成宠物。
2. 不在世界启动时生成宠物专属休息设施。
3. 不默认生成宠物抵达区或宠物休息区。
4. 不默认生成旧出生装置。
5. 宠物相关空间和设施只能通过小镇领养中心候选、管家领养意愿、AdoptionReview、AdoptionSafeApply / SafeApply 或后续建设计划进入。
6. Home System 只描述家园空间、设施、生命周期和目标，不控制宠物自主行为。

## Home Spaces

当前正式最小家园空间实体：

- empty_land
- entry_area
- temporary_shelter
- initial_care_area
- quiet_living_area
- storage_area
- garden_area
- activity_area

HomeState 仍保留原有 level / progress / status / constructionStage 等字段。

homeSpaces 用于让正式 world 页面 / 未来像素地图读取空间结构。

当前 homeSpaces 不控制宠物行为，不直接生成地图，也不接 PixiJS。

## Home Space Summary

当前已经建立 `HomeSpaceSummary`。

它用于让正式 world 页面 / 未来像素地图直接读取：

- 当前主空间
- 正在建设空间
- 已激活空间
- 可用空间
- 需要维护空间
- 可活动空间
- 家园整体舒适度 / 稳定度 / 活跃度
- 空间摘要文本

该摘要只用于展示和后续空间选择，不控制宠物行为，不直接生成像素地图。

## World Display

当前正式世界舞台可以读取 `HomeState.spaceSummary`，并通过轻量 overlay 展示：

- 当前主空间
- 家园摘要
- 建设中空间数量
- 已激活空间数量
- 可活动空间数量
- 需要维护空间数量

该展示不是 F3，不是 debug，也不接 Pixi 地图渲染。

## Butler Home Space Action

当前已经建立 `applyButlerHomeSpaceAction`。

它根据 `ButlerState.latestBehaviorExecution` 安全影响具体家园空间：

- `home_building` 推进 `temporary_shelter`
- `home_maintenance` 修复舒适度 / 稳定度最低的可用空间
- `space_tidying` 影响 `storage_area` 与 `activity_area`
- `observe_home` / `maintain_home` 用于观察和维护当前家园状态

边界：

- 不控制宠物
- 不写宠物 learning
- 不发 P-Phone
- 不新增正式 overlay
- 不新增 F3 面板
- 不把后置宠物关系提前当作开局事实

## Home Facilities

当前正式最小家园设施系统可以包含：

- resting_mat 或 shelter_bed：中性住所设施，不是宠物专属设施
- food_corner：基础生活物资点，不是宠物专属设施
- water_corner：基础生活物资点，不是宠物专属设施
- storage_box
- garden_patch
- observation_spot

设施属于 home 后台状态，不控制宠物行为，不直接改变宠物 action，不写宠物 learning。

管家行为可以安全影响设施：

- `home_building` 推进 shelter / food_corner / water_corner 等基础生活设施
- `home_maintenance` 修复最弱 active facility
- `space_tidying` 推进 storage_box / observation_spot

## Home Facility Effects

当前设施已经开始影响家园整体环境数值。

设施效果只影响：

- comfort
- stability
- expansion
- gardenProgress

设施不会直接控制宠物行为，不会直接改变宠物 action，也不会写宠物 learning。

设施状态为 `active` 时提供正向效果。
设施状态为 `needs_maintenance` 时会产生轻微负向效果。
设施状态为 `building` 时只产生极小过渡效果。

## Home Lifecycle

当前正式家园生命周期阶段：

- initial_empty_land
- temporary_shelter_phase
- basic_living_phase
- garden_opening_phase
- stable_home_phase

生命周期只描述家园发展状态，不直接控制宠物行为。

当前 lifecycle 会输出：

- phase
- phaseProgress
- mainGoal
- nextGoal
- canSupportPetExploration
- canSupportPetRest
- canSupportFoodRoutine
- canSupportGardenActivity
- summary
- tags

其中 `canSupportPetExploration / canSupportPetRest / canSupportFoodRoutine / canSupportGardenActivity` 只能表示“未来后置宠物关系是否具备环境支持”，不能表示开局已有宠物。

## Home Goals

当前目标由 lifecycle、homeSpaces、homeFacilities 共同推导。

当前正式目标包括：

- build_temporary_shelter
- complete_basic_living
- open_garden_area
- maintain_home_facilities
- prepare_future_expansion

homeGoals 只提供家园目标和推荐行为，不直接控制宠物行为。

## 与当前 MVP 文档的关系

当前 README 以用户最新三份正式文档为最高依据。

若历史文档、旧测试记录或旧架构冻结文档与本文冲突，以最新三份正式文档为准。
