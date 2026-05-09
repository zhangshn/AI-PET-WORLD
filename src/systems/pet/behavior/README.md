# behavior

当前目录属于第 8 层：行为执行层。

当前负责：预留宠物行为执行系统。behavior 只负责把内部意图表达为行为。

当前不能做：不能负责主体判断，不能写 drive / goal / attention，不能写学习规则，也不能直接读取命理核心来决定行动。

边界说明：behavior 只回答“已经形成的内部意图如何被执行或表达”。主体判断必须在上游自主驱动链中完成。

## 当前已接入入口

当前 behavior 已经建立以下包装入口：

- `opportunity-effect/pet-opportunity-effect-gateway.ts`
  - 当前包装既有 pet-opportunity 中“接受机会后的实际效果”
  - 暂不改变原运行逻辑
  - 后续逐步迁移到 behavior 内部实现

- `pet-behavior-gateway.ts`
  - 当前作为 behavior 总出口
  - 只导出行为执行层相关能力
  - 不允许直接做 drive / goal / attention / learning 判断

后续扩展方向：迁入行为表达、行为稳定、动作执行和行为 gateway。
