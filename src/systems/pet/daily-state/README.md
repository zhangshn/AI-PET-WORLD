# daily-state

当前目录属于第 4 层：生命日常状态层。

当前负责：预留宠物作为幼儿期生命的日常身体与感知状态，包括饥饿、饱腹、口渴、能量、困意、排泄、清洁、安全感、注意力、环境熟悉度、困惑与学习准备度等。

当前不能做：不能把状态直接写成行为结果，不能直接选择 action，不能替代 memory / learning，不能绕过 drive / goal / attention。

边界说明：daily-state 只回答“宠物现在处于什么状态”，不回答“宠物一定会做什么”。行为必须继续经过感知、记忆 / 学习、drive、goal、attention 和 behavior 执行链。

后续扩展方向：承接 `pet-life`、`pet-mood`、`pet-feeding` 中的状态部分，并逐步拆出身体状态、情绪状态、环境熟悉度和状态 gateway。
