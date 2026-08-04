# Live World Collision

更新时间：2026-08-03 09:23:45 +08:00

状态：active-source-module-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

碰撞投影链固定为：

```text
TileState + WorldEntity.collision
-> collisionLayer
-> walkableLayer
-> interactionLayer
-> TileState.projectedBlocksMovement / projectedBlocksVision
```

视觉图片不能决定碰撞、可走或交互事实。
