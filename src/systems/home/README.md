# Home System

当前目录负责：家园状态、建设进度与空间实体。

## Home Spaces

当前已经建立最小家园空间实体：

- empty_land
- incubator_area
- temporary_shelter
- garden_area
- storage_area
- activity_area

HomeState 仍保留原有 level / progress / status / constructionStage 等字段。

homeSpaces 用于让后续正式世界 UI / 像素地图读取空间结构。

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

当前正式世界舞台已经可以读取 `HomeState.spaceSummary`，并通过轻量 overlay 展示：

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
- `incubator_watch` 轻微提升 `incubator_area` 稳定度

边界：

- 不控制宠物
- 不写宠物 learning
- 不发 P-Phone
- 不新增正式 overlay
- 不新增 F3 面板

## Home Facilities

当前已经建立最小家园设施系统。

设施包括：

- basic_incubator
- shelter_bed
- food_corner
- water_corner
- storage_box
- garden_patch
- observation_spot

设施属于 home 后台状态，不控制宠物行为，不直接改变宠物 action，不写宠物 learning。

管家行为可以安全影响设施：

- incubator_watch 维护 basic_incubator
- home_building 推进 shelter_bed / food_corner
- home_maintenance 修复最弱 active facility
- space_tidying 推进 storage_box / observation_spot

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
