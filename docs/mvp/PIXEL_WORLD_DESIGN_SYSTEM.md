> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。

> Status: historical archive. This document is kept for historical design context only and is no longer the highest authority for AI-PET-WORLD V2.0 MVP development. Future work follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md` and the four V2.0 product documents.

# AI-PET-WORLD 像素世界设计系统

AI-PET-WORLD 的 UI 不由 AI 自由设计。UI 是世界数据的稳定显示器：它读取世界状态、地图状态、资源状态和 placement 结果，再把这些结果稳定地渲染成像素世界。

## 1. 世界显示原则

- UI 不负责决定世界是什么。
- AI 不直接自由摆放地图。
- 地图必须由 Scene Recipe + Placement Engine 生成。
- 正式 `/world` 禁止默认显示白色网格和坐标标签。
- 调试网格只能作为开发辅助层，不能成为正式默认视觉。
- 世界对象必须服务于家园、宠物、管家、资源和时间逻辑。

## 2. 禁止事项

- 禁止素材孤立摆放。
- 禁止路径断裂。
- 禁止大面积空草地。
- 禁止建筑没有地面承托。
- 禁止生活设施漂浮在无语义区域。
- 禁止角色没有活动语义点。
- 禁止出现孵化仓、胚胎、hatch。

## 3. 生成顺序

地图生成顺序固定为：

```txt
区域规划
↓
地面底色
↓
地形过渡
↓
道路
↓
建筑承托
↓
主建筑
↓
生活设施
↓
自然物件
↓
地表装饰
↓
角色
↓
氛围层
```

## 4. Scene Recipe 与 Placement Engine

Scene Recipe 定义：

- 地图尺寸
- 世界阶段
- 区域范围
- 必须素材
- 可选素材
- 禁止素材
- 连接关系
- 装饰密度
- 验收标准

Placement Engine 负责：

- 根据 recipe 放置对象。
- 检查路径连续。
- 检查建筑承托。
- 检查对象碰撞。
- 控制区域密度。
- 输出 HomeMapState。

Placement Engine 不负责：

- 运行命理算法。
- 运行宠物行为。
- 运行管家行为。
- 直接操作 React UI。
- 直接读取图片路径。

## 5. 下一轮 UI-06 接入方向

下一轮 UI-06 应改为：

```txt
/world/page.tsx
↓
读取 HomeMapState
↓
Renderer 渲染 placements
```

`/world/page.tsx` 不应该继续手写静态坐标图。它只应该作为地图状态的显示入口。
