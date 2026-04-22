/**
 * AI-PET-WORLD
 * 时间线系统 - 时序偏移层类型定义（第一版）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件专门负责定义 timeline-system 中“时序偏移层”的核心类型。
 *
 * 它只定义：
 * - 阶段标签（FortunePhaseTag）
 * - 偏移来源层级（FortuneSourceLayer）
 * - 单条偏移值（FortuneBiasValue）
 * - 偏移集合（FortuneModifierSet）
 * - 当前时序偏移（TemporalInfluence）
 * - 未来阶段预览（FortuneProjection）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件不负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件不负责：
 * - 大运/流年/流月/流日的实际计算
 * - 当前时间对应什么阶段的判断
 * - 偏移如何真正作用到状态层
 * - 未来结果文本生成
 *
 * 它只是“时序偏移层的数据结构基础文件”。
 *
 * ----------------------------------------------------------------------------
 * 【时序偏移层在系统中的位置】
 * ----------------------------------------------------------------------------
 * 先天人格固定存在
 * -> 事件推动当前状态变化
 * -> 状态与行为沉淀为生命轨迹
 * -> 时间进入不同阶段
 * -> 某些倾向在某个阶段更容易被放大或抑制
 *
 * 所以时序偏移层不是新的先天人格，
 * 而是“当前阶段对既有生命线的偏向性放大”。
 */

/* -------------------------------------------------------------------------- */
/* 一、基础通用类型                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 比例值
 *
 * 推荐语义：
 * - 一般用于 0 ~ 1 的归一化数值
 * - 用于强度、概率倾向、阶段明显程度
 */
export type RatioValue = number;

/**
 * 偏移值
 *
 * 推荐语义：
 * - 一般用于 -1 ~ 1 的正负修正值
 * - 正数表示增强 / 放大
 * - 负数表示压低 / 收缩
 */
export type BiasDeltaValue = number;

/* -------------------------------------------------------------------------- */
/* 二、阶段标签                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 时序阶段标签
 *
 * 用于描述：
 * 当前时间阶段更容易把生命线推向哪一类状态显化。
 *
 * 注意：
 * - 它不是人格标签
 * - 它也不是生命轨迹分支标签
 * - 它是“当前阶段偏向标签”
 */
export type FortunePhaseTag =
  | "stable_phase"      // 平稳阶段
  | "growth_phase"      // 成长扩张阶段
  | "sensitive_phase"   // 敏感波动阶段
  | "recovery_phase"    // 修整恢复阶段
  | "attachment_phase"  // 亲近依附阶段
  | "withdrawal_phase"; // 收缩回避阶段

/* -------------------------------------------------------------------------- */
/* 三、偏移来源层级                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 偏移来源层级
 *
 * 用于说明：
 * 当前这条时序偏移是来自哪一层时间来源。
 *
 * 这样后面你正式接入 fortune-engine 时，
 * 就可以把不同来源分开记录。
 */
export type FortuneSourceLayer =
  | "major_cycle" // 大运 / 长周期
  | "yearly"      // 流年
  | "monthly"     // 流月
  | "daily"       // 流日
  | "current";    // 当前阶段临时偏移 / 当前快照层

/* -------------------------------------------------------------------------- */
/* 四、单条偏移值结构                                                           */
/* -------------------------------------------------------------------------- */

/**
 * 单条偏移项
 *
 * 用于表达：
 * 某一个维度在当前阶段，正被怎样偏移。
 *
 * 例如：
 * - awareness +0.15
 * - stress +0.20
 * - explore -0.10
 *
 * 它的意义不是“直接改写本体”，
 * 而是作为后续状态计算时的修正输入。
 */
export interface FortuneBiasValue {
  /**
   * 偏移来源层级
   *
   * 例如：
   * - 来自 yearly
   * - 来自 monthly
   * - 来自 daily
   */
  source: FortuneSourceLayer;

  /**
   * 偏移强度，建议范围 -1 ~ 1
   *
   * 正数：
   * - 表示更容易增强、放大
   *
   * 负数：
   * - 表示更容易抑制、压低
   */
  delta: BiasDeltaValue;

  /**
   * 该偏移的说明文字
   *
   * 用途：
   * - 调试页
   * - 日后解释 current phase
   * - 后台可读说明
   */
  reason?: string;
}

/* -------------------------------------------------------------------------- */
/* 五、状态层偏移集合                                                           */
/* -------------------------------------------------------------------------- */

/**
 * 情绪层偏移集合
 *
 * 当前第一版先保留最核心维度。
 */
export interface EmotionalBiasMap {
  valence?: FortuneBiasValue[];
  arousal?: FortuneBiasValue[];
  stability?: FortuneBiasValue[];
  labelWeight?: FortuneBiasValue[];
}

/**
 * 认知层偏移集合
 */
export interface CognitiveBiasMap {
  focus?: FortuneBiasValue[];
  awareness?: FortuneBiasValue[];
  curiosity?: FortuneBiasValue[];
  stress?: FortuneBiasValue[];
  labelWeight?: FortuneBiasValue[];
}

/**
 * 动力层偏移集合
 */
export interface DriveBiasMap {
  rest?: FortuneBiasValue[];
  eat?: FortuneBiasValue[];
  explore?: FortuneBiasValue[];
  approach?: FortuneBiasValue[];
  avoid?: FortuneBiasValue[];
  primaryWeight?: FortuneBiasValue[];
}

/**
 * 关系层偏移集合
 */
export interface RelationalBiasMap {
  trust?: FortuneBiasValue[];
  safety?: FortuneBiasValue[];
  attachment?: FortuneBiasValue[];
  distance?: FortuneBiasValue[];
  familiarity?: FortuneBiasValue[];
  labelWeight?: FortuneBiasValue[];
}

/**
 * 全部偏移集合
 *
 * 用于表达：
 * 当前阶段会对哪些状态层维度施加方向性修正。
 *
 * 注意：
 * 当前第一版先不直接去碰 physical，
 * 因为 physical 更多是世界时间推进、行为消耗、恢复逻辑直接驱动。
 * 后面如果你要加，也可以扩：
 * - energy
 * - hunger
 * - health
 * - recovery
 */
export interface FortuneModifierSet {
  emotional?: EmotionalBiasMap;
  cognitive?: CognitiveBiasMap;
  drive?: DriveBiasMap;
  relational?: RelationalBiasMap;
}

/* -------------------------------------------------------------------------- */
/* 六、当前时序偏移总结构                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 当前时序偏移层
 *
 * 这一层回答的问题是：
 * - 现在正处在怎样的阶段？
 * - 这个阶段对当前生命线有什么偏向？
 * - 哪些倾向正在更容易被放大？
 *
 * 它不直接改写先天人格，
 * 而是给状态和行为生成提供“阶段修正背景”。
 */
export interface TemporalInfluence {
  /**
   * 当前阶段标签
   */
  phaseTag: FortunePhaseTag;

  /**
   * 当前阶段强度，建议范围 0 ~ 1
   *
   * 含义：
   * - 越高：说明这个阶段感越明显
   * - 越低：说明当前阶段偏向比较弱，更接近平稳状态
   */
  phaseStrength: RatioValue;

  /**
   * 当前阶段摘要
   *
   * 用于：
   * - world 页面展示
   * - 调试页说明
   * - 未来映射背景说明
   *
   * 示例：
   * - "当前阶段更容易放大警觉与回避倾向。"
   * - "当前阶段更容易显化探索和外向接触。"
   */
  summary: string;

  /**
   * 当前阶段修正项
   *
   * 后续状态更新时，
   * 可以把这些修正项叠加到 state 的计算流程里。
   */
  modifiers: FortuneModifierSet;
}

/* -------------------------------------------------------------------------- */
/* 七、未来阶段预览结构                                                         */
/* -------------------------------------------------------------------------- */

/**
 * 未来阶段预览
 *
 * 用于表达：
 * - 接下来一个阶段可能更偏什么
 * - 不是绝对结果
 * - 而是“更容易出现的倾向预估”
 *
 * 这对你后面的 future mapping 很重要。
 */
export interface FortuneProjection {
  /**
   * 预览标题
   *
   * 例如：
   * - "下一阶段预估"
   * - "接下来数日偏向"
   * - "近期阶段走向"
   */
  title: string;

  /**
   * 预计阶段标签
   */
  phaseTag: FortunePhaseTag;

  /**
   * 预计阶段强度，建议范围 0 ~ 1
   */
  phaseStrength: RatioValue;

  /**
   * 预览说明
   *
   * 注意：
   * 这是“倾向说明”，不是绝对剧本。
   */
  summary: string;

  /**
   * 预计修正项
   *
   * 未来可以用于：
   * - 提前展示哪些状态更容易被放大
   * - 给后台预测逻辑用
   */
  projectedModifiers?: FortuneModifierSet;
}