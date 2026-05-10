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
