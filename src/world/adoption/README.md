# Adoption Center

当前目录负责：承载“小镇宠物领养中心 / 宠物抵达”业务概念。

PIVOT-01 阶段只做最小兼容迁移：

- 保留旧 `IncubatorState` / `IncubatorSystem`，避免旧存档崩溃。
- 新增 `AdoptionState`，用于产品层表达领养申请、分配、送达和抵达。
- 通过 `buildAdoptionStateFromIncubator` 把旧运行状态派生为新的 adoption / arrival 状态。
- 不做正式小镇 UI。
- 不做完整管家报名流程。
- 不改命理算法。

当前兼容映射：

```txt
incubating      -> preparing_arrival
ready_to_hatch  -> ready_to_arrive
hatched         -> arrived
progress        -> progress
stability       -> readiness
embryoName      -> pendingPetName
```

产品语义上，宠物抵达家园的那一刻才是它与这个世界建立关系的命格时刻。当前只建立状态命名与兼容层，真正的抵达时刻接入留给后续批次。
