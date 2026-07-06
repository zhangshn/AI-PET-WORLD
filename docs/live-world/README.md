# AI 活世界生成系统文档入口

更新日期：2026-07-06

本目录是 AI Pet World “活世界生成系统”的唯一正式文档入口。后续世界规则、Schema、AI Painter 视觉输入、候选归档、样本闭环、Runtime 激活等工作，都以这里的文档为准。

## 文档目录

| 文档 | 职责 |
|---|---|
| [AI_LIVE_WORLD_MVP_TECHNICAL_SPEC.md](./AI_LIVE_WORLD_MVP_TECHNICAL_SPEC.md) | 定版技术方案，包含项目目标、架构、数据边界、Schema、视觉生成协议、归档、验收和路线。 |
| [DIRECTORY_STRUCTURE.md](./DIRECTORY_STRUCTURE.md) | 活世界相关文档、代码、数据、训练产物、候选图、正式样本和 Runtime 数据的目录结构。 |

## 核心结论

```txt
世界不是图片。
图片只是世界状态的一次视觉表达。

程序生成和维护世界事实。
AI Painter 根据结构化 ChunkVisualInput 生成视觉。
视觉输出先进入候选库，人工复核后才允许进入样本库。
```

## 当前阶段

当前阶段为：

```txt
P0 Schema 收口与工程目录落地
```

允许做：

```txt
types
schema
placement rules
mask spec
archive spec
POC-0 input spec
engineering safety spec
```

暂不做：

```txt
AI Painter 正式接入
5x5 世界生成
Runtime 完整激活系统
自动评审
训练闭环
整图训练
高清输出
```

