# butler/runtime-orchestration

当前目录属于 Runtime 编排层。

## 当前负责

这里未来负责管家系统单 tick 或运行周期的编排入口。

Runtime 编排层只应该组织调用 memory-relation、task、intention、education、message-decision、behavior 等层级，不应该继续堆具体业务判断。

## 当前不能做

- 不能新增复杂管家业务判断
- 不能替代 intention / education / message-decision
- 不能写 P-Phone UI
- 不能直接决定宠物行为
- 不能绕过 gateway 深层调用旧模块

## 后续扩展方向

- runtime-orchestration gateway
- butler tick 编排
- 旧 butlerSystem 行为保持兼容
- 逐步把编排逻辑收敛为调用各层 gateway
