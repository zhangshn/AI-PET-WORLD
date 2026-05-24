> 历史归档：本文件不得作为 V2.6 当前产品、架构或开发依据。  
> 当前最高依据为 V2.6 三份核心文档。当前业务口径是：管家是第一主角；宠物不是开局资产；宠物来源于小镇领养中心；真正驱动宠物进场的是管家自主产生的领养意愿，并且必须通过 AdoptionReview 与 SafeApply 后才可以成为 HomeMapState 世界事实。  
> 本文件如出现孵化器、胚胎、pet_arrival、pet_rest、LifeEvent、CompanionDecision、伴生生命、候选宠物等旧词，仅代表历史阶段记录，不代表当前实现方向。

> Status: phase record. This document is kept for development traceability. Current development follows `src/docs/AI_PET_WORLD_V2_MVP_EXECUTION_PLAN_2026-05-23.md`.

# AI-PET-WORLD P8-G1 点线面图形生成基础协议

本阶段根据定版文档补齐“点、线、面组成图形”的基础层。

Point / Line / Polygon 是工程抽象，不是最开始的思想本身。世界对象在进入工程协议之前，应先被理解为点、线、面之间的结构关系。

本层用 ShapeGrammarPoint / ShapeGrammarLine / ShapeGrammarSurface 描述世界对象：

1. ShapeGrammarPoint 表达位置、锚点、入口、生长点、支撑点等。
2. ShapeGrammarLine 表达连接、边界、道路中心、墙体、河流、结构梁等。
3. ShapeGrammarSurface 表达土地、水域、森林、地基、屋顶、活动区、碰撞区、影响区等。

树不是 tree.png：

1. 点：树干中心、生长点。
2. 线：树干方向。
3. 面：树冠、根系、树荫。

房屋不是 house.png：

1. 点：入口点、支撑点。
2. 线：墙线、屋脊线。
3. 面：地基、屋顶、室内、碰撞面。

道路不是 path.png：

1. 点：起点、终点。
2. 线：中心线、边界线。
3. 面：道路面、影响面。

本阶段不修改 Renderer。

本阶段不修改 world-loop。

本阶段不生成世界事实，只提供几何语法协议。

后续阶段再把 shape-grammar 接入 placement geometry adapter。
