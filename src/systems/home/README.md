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
