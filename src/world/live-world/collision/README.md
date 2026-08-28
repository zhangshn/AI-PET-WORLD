# Live World Collision

更新时间：2026-08-03 09:23:45 +08:00

状态：active-source-module-contract

Codex等外部执行智能体不得超出当前用户任务范围；本地程序在生效业务、安全和机器合同内自主运行，不从聊天或本句推导逐步Owner审批。

碰撞投影链固定为：

```text
TileState + WorldEntity.collision
-> collisionLayer
-> walkableLayer
-> interactionLayer
-> TileState.projectedBlocksMovement / projectedBlocksVision
```

视觉图片不能决定碰撞、可走或交互事实。
