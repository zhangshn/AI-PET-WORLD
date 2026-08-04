# Live World Module

更新时间：2026-08-03 09:23:45 +08:00

状态：active-source-module-contract

不允许自由发挥；除非发现错误导致无法继续，必须先停下来询问项目所有者。

本模块承载 World、Region、Chunk、Tile、Entity、生命周期、碰撞、视觉输入、候选、审核和样本的数据合同及运行实现。

模块只通过版本化接口与 AI Painter、RuntimeFrame 和 `/world` 连接。AI Painter 不得决定世界事实；候选、审核和训练编排不得绕过各自授权与资格门禁。
