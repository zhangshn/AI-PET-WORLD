/**
 * AI-PET-WORLD
 * 时间线系统核心类型定义（第一版）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件不是先天人格系统。
 * 先天人格仍然由 src/ai/personality-core 负责。
 *
 * 这个文件负责定义“时间线系统”的核心类型结构，用来描述：
 *
 * 1. 当前状态层（State Layer）
 *    - 宠物此刻处于什么状态
 *    - 包括五大类状态：
 *      emotional / physical / cognitive / drive / relational
 *
 * 2. 生命轨迹层（Trajectory Layer）
 *    - 宠物一路经历了什么
 *    - 这些经历如何沉淀为长期趋势
 *    - 当前更偏向哪条生命分支
 *
 * 3. 时序偏移层（Fortune Layer）
 *    - 某个阶段更容易放大什么倾向
 *    - 未来用于承接大运 / 流年 / 流月 / 流日
 *
 * 4. 时间线总快照（Timeline Snapshot）
 *    - 把当前状态、生命轨迹、时序偏移统一打包
 *
 * ----------------------------------------------------------------------------
 * 【系统总逻辑】
 * ----------------------------------------------------------------------------
 * 先天人格固定生成
 * -> 时间推进
 * -> 事件发生
 * -> 在先天人格框架内引发状态变化
 * -> 状态推动行为
 * -> 行为与事件沉淀为生命轨迹
 * -> 时序推演在某一阶段放大某些倾向
 *
 * ----------------------------------------------------------------------------
 * 【重要边界】
 * ----------------------------------------------------------------------------
 * 1. 这里不定义紫微斗数排盘逻辑
 * 2. 这里不替代 personality-core
 * 3. 这里是“动态时间线系统”的结构层
 * 4. 这里先只定义类型，不写更新算法
 */

/* -------------------------------------------------------------------------- */
/* 一、基础通用类型                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 比例值
 *
 * 推荐语义：
 * - 一般用于 0 ~ 1 的归一化数值
 * - 例如：0 表示完全没有，1 表示非常强
 *
 * 当前只做类型别名，不在这里做运行时约束。
 * 后续如果需要，可以统一增加 clamp 工具做边界收敛。
 */
export type RatioValue = number;

/**
 * 百分比/资源值
 *
 * 推荐语义：
 * - 一般用于 0 ~ 100 的资源型数值
 * - 例如：精力、饥饿、健康
 */
export type PercentValue = number;

/**
 * 时间线标签
 *
 * 当前先统一用 string，方便扩展。
 * 后续系统稳定后，再逐步收紧成更细的联合类型。
 */
export type TimelineTag = string;

/* -------------------------------------------------------------------------- */
/* 二、状态层（State Layer）                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 情绪标签
 *
 * 用于给 UI / 文案 / 页面展示层直接使用。
 *
 * 注意：
 * - 它是“综合结果标签”
 * - 不是底层唯一真值
 * - 底层变化主要还是靠数值维度来计算
 */
export type EmotionalLabel =
  | "relaxed"   // 放松
  | "content"   // 满足
  | "curious"   // 好奇
  | "excited"   // 兴奋
  | "alert"     // 警觉
  | "irritated" // 烦躁
  | "anxious"   // 不安
  | "low"       // 低落
  | "neutral";  // 中性

/**
 * 情绪状态
 *
 * 这一层回答的问题是：
 * - 宠物现在整体感觉舒服还是不舒服？
 * - 宠物现在平静还是激动？
 * - 宠物现在稳定还是容易波动？
 *
 * 注意：
 * - 这是“当前情绪状态”
 * - 不是“天生人格”
 * - 它一定是在先天人格底盘之上波动的
 */
export interface EmotionalState {
  /**
   * 情绪正负方向，建议范围 -1 ~ 1
   *
   * 参考理解：
   * - -1 = 强烈不适 / 很低落 / 明显抗拒
   * -  0 = 中性
   * -  1 = 很满足 / 很愉快 / 很舒展
   */
  valence: number;

  /**
   * 情绪激活度，建议范围 0 ~ 1
   *
   * 参考理解：
   * - 0   = 非常平静
   * - 0.5 = 普通活跃
   * - 1   = 很兴奋，或很紧绷
   *
   * 注意：
   * 高 arousal 不一定是开心，
   * 也可能是紧张、警觉、烦躁。
   */
  arousal: RatioValue;

  /**
   * 情绪稳定度，建议范围 0 ~ 1
   *
   * 含义：
   * - 越高：越稳定，不容易被轻微事件打断
   * - 越低：越敏感，更容易因为刺激产生明显波动
   */
  stability: RatioValue;

  /**
   * 当前情绪主标签
   *
   * 这是给 UI / 文案系统看的“结果层标签”。
   * 后续通常由 state-classifier 负责从底层数值推导出来。
   */
  label: EmotionalLabel;
}

/**
 * 生理标签
 *
 * 给展示层直接使用。
 */
export type PhysicalLabel =
  | "energetic"  // 精力充足
  | "stable"     // 身体状态稳定
  | "hungry"     // 饥饿明显
  | "tired"      // 疲惫
  | "recovering" // 恢复中
  | "weak";      // 虚弱

/**
 * 生理状态
 *
 * 这一层回答的问题是：
 * - 宠物有没有精力？
 * - 宠物饿不饿？
 * - 身体舒服不舒服？
 * - 当前更偏恢复还是偏消耗？
 *
 * 这是行为决策最直接的输入之一。
 */
export interface PhysicalState {
  /**
   * 精力值，建议范围 0 ~ 100
   *
   * 常见用途：
   * - 精力低 -> 更容易休息
   * - 精力高 -> 更容易探索 / 移动
   */
  energy: PercentValue;

  /**
   * 饥饿值，建议范围 0 ~ 100
   *
   * 常见用途：
   * - 饥饿高 -> 更容易触发 eating
   * - 可随时间自然上升
   */
  hunger: PercentValue;

  /**
   * 健康 / 舒适度，建议范围 0 ~ 100
   *
   * 当前阶段先把它理解成“身体舒不舒服”的综合值。
   * 先不把它做成复杂医疗系统。
   */
  health: PercentValue;

  /**
   * 恢复倾向，建议范围 0 ~ 1
   *
   * 用于表达当前是否处在恢复节奏中。
   * 后续可和：
   * - 睡眠
   * - 安静停留
   * - 孵化后恢复
   * - 某些事件修复
   * 联动。
   */
  recovery: RatioValue;

  /**
   * 当前生理标签
   *
   * 给 world 页面、事件文案等直接使用。
   */
  label: PhysicalLabel;
}

/**
 * 认知/注意标签
 *
 * 用于表达当前处理外界的主要方式。
 */
export type CognitiveLabel =
  | "idle"       // 松散 / 空闲
  | "observing"  // 观察中
  | "focused"    // 专注中
  | "curious"    // 对外界有兴趣
  | "hesitant"   // 迟疑
  | "stressed"   // 精神压力明显
  | "avoidant";  // 倾向回避

/**
 * 认知 / 注意状态
 *
 * 这一层回答的问题是：
 * - 宠物现在是不是在观察外界？
 * - 宠物现在是不是很专注？
 * - 宠物对周围刺激敏不敏感？
 * - 宠物有没有探索兴趣？
 * - 宠物现在更主动还是更迟疑？
 */
export interface CognitiveState {
  /**
   * 专注度，建议范围 0 ~ 1
   *
   * 含义：
   * - 越高：当前行为更容易持续，不容易被打断
   * - 越低：注意更分散，更容易切换行为
   */
  focus: RatioValue;

  /**
   * 环境感知度，建议范围 0 ~ 1
   *
   * 含义：
   * - 越高：对周围变化越敏感
   * - 越低：对变化较迟钝
   */
  awareness: RatioValue;

  /**
   * 探索兴趣，建议范围 0 ~ 1
   *
   * 这里表达的是：
   * “当前是否想看一看、碰一碰、靠近未知”
   *
   * 它不是最终行为结果，
   * 只是认知层面的探索欲。
   */
  curiosity: RatioValue;

  /**
   * 压力 / 认知负担，建议范围 0 ~ 1
   *
   * 含义：
   * - 越高：越紧张、越难放松
   * - 越高时通常更容易触发警觉或回避
   */
  stress: RatioValue;

  /**
   * 当前认知标签
   *
   * 给展示层使用的抽象结果。
   */
  label: CognitiveLabel;
}

/**
 * 主驱动力标签
 *
 * 当前最强的行为倾向。
 *
 * 它是状态层到行为层之间最关键的桥梁。
 */
export type PrimaryDrive =
  | "rest"     // 想休息
  | "eat"      // 想进食
  | "explore"  // 想探索
  | "approach" // 想靠近
  | "avoid"    // 想回避
  | "idle";    // 暂无明显主驱动力

/**
 * 动力状态
 *
 * 这一层回答的问题是：
 * - 宠物现在最想做什么？
 *
 * 它不是简单“感受”，而是行为方向上的推动力。
 */
export interface DriveState {
  /**
   * 休息驱动力，建议范围 0 ~ 1
   */
  rest: RatioValue;

  /**
   * 进食驱动力，建议范围 0 ~ 1
   */
  eat: RatioValue;

  /**
   * 探索驱动力，建议范围 0 ~ 1
   */
  explore: RatioValue;

  /**
   * 接近驱动力，建议范围 0 ~ 1
   *
   * 用于表达：
   * - 想靠近照顾者
   * - 想靠近熟悉对象
   * - 想停留在熟悉区域附近
   */
  approach: RatioValue;

  /**
   * 回避驱动力，建议范围 0 ~ 1
   *
   * 用于表达：
   * - 想躲开刺激
   * - 想退回安全区域
   * - 想和对象保持距离
   */
  avoid: RatioValue;

  /**
   * 当前主驱动力
   *
   * 一般由上面几个驱动力比较后得出。
   * 行为系统后续通常会优先看这个字段。
   */
  primary: PrimaryDrive;
}

/**
 * 关系标签
 *
 * 用来给世界页和事件文案提供直观描述。
 */
export type RelationalLabel =
  | "secure"   // 安全、安心
  | "attached" // 亲近、依附
  | "neutral"  // 中性
  | "guarded"  // 保留、防备
  | "distant"; // 疏离

/**
 * 关系状态
 *
 * 这一层回答的问题是：
 * - 宠物现在觉得环境安全吗？
 * - 宠物现在是否愿意亲近？
 * - 宠物现在是否有疏离/防备倾向？
 * - 宠物对当前环境熟不熟悉？
 *
 * 当前第一版先做总关系状态，
 * 不先拆成 butler/home/zone 的多对象版本。
 */
export interface RelationalState {
  /**
   * 信任感，建议范围 0 ~ 1
   */
  trust: RatioValue;

  /**
   * 安全感，建议范围 0 ~ 1
   */
  safety: RatioValue;

  /**
   * 依附 / 亲近倾向，建议范围 0 ~ 1
   */
  attachment: RatioValue;

  /**
   * 疏离 / 防备倾向，建议范围 0 ~ 1
   *
   * 注意：
   * 它不一定和 attachment 完全互斥，
   * 因为某些生命体可能会同时存在“想靠近但又保留”的状态。
   */
  distance: RatioValue;

  /**
   * 熟悉感，建议范围 0 ~ 1
   *
   * 后续可与：
   * - 家园熟悉度
   * - 区域熟悉度
   * - 照顾者关系熟悉度
   * 继续联动。
   */
  familiarity: RatioValue;

  /**
   * 当前关系标签
   */
  label: RelationalLabel;
}

/**
 * 宠物当前状态总结构
 *
 * 这是五大状态分类的统一入口。
 *
 * 注意：
 * - 它描述的是“此刻状态”
 * - 它不是先天人格本身
 * - 它一定建立在先天人格底盘之上
 */
export interface PetState {
  emotional: EmotionalState;
  physical: PhysicalState;
  cognitive: CognitiveState;
  drive: DriveState;
  relational: RelationalState;
}

/* -------------------------------------------------------------------------- */
/* 三、轨迹层（Trajectory Layer）                                               */
/* -------------------------------------------------------------------------- */

/**
 * 时间线事件记录
 *
 * 用于把关键经历记录进生命轨迹里。
 *
 * 这里的事件不是全项目所有事件的替代品，
 * 而是“和时间线演化有关的记录单元”。
 */
export interface TimelineEventRecord {
  /**
   * 事件唯一 ID
   */
  id: string;

  /**
   * 事件发生时的 world tick
   */
  tick: number;

  /**
   * 事件发生时的天数
   */
  day: number;

  /**
   * 事件发生时的小时
   */
  hour: number;

  /**
   * 事件类型
   *
   * 示例：
   * - "born"
   * - "fed"
   * - "rested"
   * - "behavior_shift"
   * - "mood_shift"
   * - "comforted"
   * - "disturbed"
   */
  type: string;

  /**
   * 事件简述
   *
   * 用于：
   * - 调试
   * - 时间线摘要
   * - 未来回放
   */
  message: string;

  /**
   * 事件影响强度，建议范围 0 ~ 1
   *
   * 作用：
   * - 后续可用于表示这个事件对状态/轨迹影响有多大
   * - 当前先作为预留字段
   */
  impact?: RatioValue;

  /**
   * 附加数据
   *
   * 当前先保持宽松。
   * 等系统稳定后再慢慢收紧。
   */
  payload?: Record<string, unknown>;
}

/**
 * 趋势方向
 *
 * 用来表达某个长期倾向是在增强、稳定，还是下降。
 */
export type TrendDirection =
  | "rising"  // 上升中
  | "stable"  // 稳定
  | "falling";// 下降中

/**
 * 轨迹趋势结构
 *
 * 它不是“当前状态”，而是“长期走向”。
 */
export interface TrajectoryTrend {
  /**
   * 趋势方向
   */
  direction: TrendDirection;

  /**
   * 趋势强度，建议范围 0 ~ 1
   *
   * 强度越高，说明这个趋势越明显。
   */
  strength: RatioValue;
}

/**
 * 分支标签
 *
 * 用于表达“当前生命线更偏向哪种发展路径”。
 *
 * 注意：
 * - 这不是先天人格标签
 * - 这是经历累积后的生命线倾向
 * - 它可以随着长期积累逐渐变化
 */
export type BranchTag =
  | "balanced"   // 相对平衡
  | "attachment" // 亲近依附路径
  | "defense"    // 防御回避路径
  | "curiosity"  // 探索成长路径
  | "recovery"   // 修整恢复路径
  | "survival";  // 生存应对路径

/**
 * 生命轨迹
 *
 * 这一层回答的问题是：
 * - 这只宠物一路经历了什么？
 * - 它长期正在往哪个方向走？
 * - 当前它更接近哪条生命分支？
 *
 * 它和 PetState 的区别：
 * - PetState = 此刻怎样
 * - LifeTrajectory = 一路怎么走到现在
 */
export interface LifeTrajectory {
  /**
   * 已记录的重要事件历史
   *
   * 当前第一版直接用数组。
   * 后续如果量大，可拆成：
   * - recentHistory
   * - milestones
   * - aggregatedCounters
   */
  history: TimelineEventRecord[];

  /**
   * 信任趋势
   *
   * 长期看是否越来越信任照顾者 / 环境。
   */
  trustTrend: TrajectoryTrend;

  /**
   * 压力趋势
   *
   * 长期看是否越来越紧绷、越来越有负担。
   */
  stressTrend: TrajectoryTrend;

  /**
   * 探索趋势
   *
   * 长期看是否越来越愿意移动、观察、接触未知。
   */
  explorationTrend: TrajectoryTrend;

  /**
   * 依附趋势
   *
   * 长期看是否越来越靠近熟悉对象 / 熟悉空间。
   */
  attachmentTrend: TrajectoryTrend;

  /**
   * 回避趋势
   *
   * 长期看是否越来越容易退缩、防御、回避刺激。
   */
  avoidanceTrend: TrajectoryTrend;

  /**
   * 当前生命分支标签
   *
   * 这是对当前生命线整体方向的抽象总结。
   */
  branchTag: BranchTag;

  /**
   * 当前阶段摘要
   *
   * 给 UI / world 页面 / 调试页使用的可读简述。
   *
   * 示例：
   * - "逐渐形成对照顾者的依附倾向"
   * - "近期更偏向谨慎观察与回避刺激"
   * - "正在从恢复阶段转向探索阶段"
   */
  summary: string;
}

/* -------------------------------------------------------------------------- */
/* 四、时序偏移层（Fortune Layer）                                              */
/* -------------------------------------------------------------------------- */

/**
 * 时序阶段标签
 *
 * 这是未来 fortune-engine 输出给外部看的阶段描述。
 * 当前先做第一版最小集合。
 */
export type FortunePhaseTag =
  | "stable_phase"        // 平稳阶段
  | "growth_phase"        // 成长扩张阶段
  | "sensitive_phase"     // 敏感波动阶段
  | "recovery_phase"      // 恢复整合阶段
  | "attachment_phase"    // 亲近依附阶段
  | "withdrawal_phase";   // 收缩回避阶段

/**
 * 时序偏移修正项
 *
 * 用于表达“当前阶段更容易把哪些倾向放大或压低”。
 *
 * 当前先用宽松字段，后续再逐渐收紧成更明确结构。
 */
export interface FortuneModifierSet {
  /**
   * 对情绪层的偏移建议
   *
   * 示例：
   * - 更容易 alert
   * - 更容易 content
   */
  emotionalBias?: Record<string, number>;

  /**
   * 对认知层的偏移建议
   *
   * 示例：
   * - awareness +0.1
   * - stress +0.15
   */
  cognitiveBias?: Record<string, number>;

  /**
   * 对动力层的偏移建议
   *
   * 示例：
   * - explore +0.2
   * - avoid +0.25
   */
  driveBias?: Record<string, number>;

  /**
   * 对关系层的偏移建议
   *
   * 示例：
   * - trust +0.1
   * - distance +0.15
   */
  relationalBias?: Record<string, number>;
}

/**
 * 时序偏移层
 *
 * 这一层回答的问题是：
 * - 当前这个阶段，更容易显化什么？
 * - 某些状态和行为，是否在这个阶段被放大了？
 *
 * 注意：
 * - 它不推翻先天人格
 * - 它不替代事件
 * - 它是在先天人格 + 生命轨迹基础上提供“阶段性偏向”
 */
export interface TemporalInfluence {
  /**
   * 当前阶段标签
   */
  phaseTag: FortunePhaseTag;

  /**
   * 当前阶段强度，建议范围 0 ~ 1
   *
   * 越高表示当前阶段偏向越明显。
   */
  phaseStrength: RatioValue;

  /**
   * 当前阶段说明
   *
   * 用于：
   * - world 页面抽象展示
   * - 调试页说明
   * - future mapping 的文字描述
   */
  summary: string;

  /**
   * 当前阶段对各层的修正项
   */
  modifiers: FortuneModifierSet;
}

/* -------------------------------------------------------------------------- */
/* 五、时间线总快照（Timeline Snapshot）                                        */
/* -------------------------------------------------------------------------- */

/**
 * 时间线系统总快照
 *
 * 这是 timeline-system 对外最重要的统一结构之一。
 *
 * 它把：
 * - 当前状态
 * - 当前生命轨迹
 * - 当前阶段性时序偏移
 * 打包在一起。
 *
 * 后续 worldEngine / petSystem / world page
 * 都可以围绕这个结构来组织数据。
 */
export interface PetTimelineSnapshot {
  /**
   * 当前状态层快照
   */
  state: PetState;

  /**
   * 当前生命轨迹快照
   */
  trajectory: LifeTrajectory;

  /**
   * 当前时序偏移
   *
   * 当前先允许为空，
   * 因为 fortune-engine 可能晚一点才正式接入。
   */
  fortune?: TemporalInfluence;
}