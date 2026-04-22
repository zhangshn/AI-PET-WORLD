/**
 * AI-PET-WORLD
 * 时间线系统 - 生命分支计算器（第一版）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件专门负责根据 LifeTrajectory 的已有信息，
 * 判断当前生命时间线更偏向哪一种分支路径。
 *
 * 当前第一版主要做三件事：
 * 1. 读取轨迹历史（history）
 * 2. 读取长期趋势（trustTrend / stressTrend / explorationTrend ...）
 * 3. 计算各分支分数，并选出当前 branchTag
 *
 * ----------------------------------------------------------------------------
 * 【这个文件不负责什么？】
 * ----------------------------------------------------------------------------
 * 当前第一版不负责：
 * - 写入 history
 * - 更新趋势本身
 * - 生成 summary 文案
 * - 更新状态
 * - 计算 fortune 偏移
 *
 * 它只是“根据已有轨迹结果，判断当前分支方向”。
 */

import type {
  BranchTag,
  LifeTrajectory,
  TimelineEventRecord,
  TrajectoryTrend,
  TrendDirection,
} from "./trajectory-types";

/* -------------------------------------------------------------------------- */
/* 一、分支分数结构                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 所有分支的分数字典
 *
 * 用来记录当前生命时间线在每一条路径上的偏向强度。
 */
export interface BranchScoreMap {
  balanced: number;
  attachment: number;
  defense: number;
  curiosity: number;
  recovery: number;
  survival: number;
}

/* -------------------------------------------------------------------------- */
/* 二、基础工具函数                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 创建默认分支分数
 *
 * 初始策略：
 * - balanced 默认给一个基础分
 * - 其他分支从 0 开始
 *
 * 理由：
 * - 当生命线信息还很少时，默认应该更偏向 balanced
 * - 只有在轨迹逐渐累积后，其他分支才应慢慢浮现
 */
export function createDefaultBranchScoreMap(): BranchScoreMap {
  return {
    balanced: 1,
    attachment: 0,
    defense: 0,
    curiosity: 0,
    recovery: 0,
    survival: 0,
  };
}

/**
 * 把趋势方向转换成数值权重
 *
 * 规则：
 * - rising  ->  1
 * - stable  ->  0
 * - falling -> -1
 *
 * 用途：
 * - 让 trend 结构更方便参与分支计算
 */
export function getTrendDirectionWeight(direction: TrendDirection): number {
  switch (direction) {
    case "rising":
      return 1;
    case "falling":
      return -1;
    case "stable":
    default:
      return 0;
  }
}

/**
 * 计算单条趋势的有效影响值
 *
 * 公式思路：
 * - 趋势方向决定正负
 * - 趋势强度决定大小
 *
 * 例如：
 * - rising + 0.8  => +0.8
 * - falling + 0.6 => -0.6
 * - stable + 0.2  => 0
 */
export function getTrendEffectValue(trend: TrajectoryTrend): number {
  return getTrendDirectionWeight(trend.direction) * trend.strength;
}

/**
 * 安全增加某个分支分数
 *
 * 作用：
 * - 简化计算逻辑
 * - 避免外面重复手写 scores.xxx += value
 */
export function addBranchScore(
  scores: BranchScoreMap,
  branch: BranchTag,
  value: number
): void {
  scores[branch] += value;
}

/* -------------------------------------------------------------------------- */
/* 三、基于趋势的分支加权                                                       */
/* -------------------------------------------------------------------------- */

/**
 * 根据“信任趋势”加权分支分数
 *
 * 逻辑：
 * - 信任上升 -> attachment 更容易形成
 * - 信任下降 -> defense / survival 更容易形成
 */
export function applyTrustTrendToBranchScores(
  scores: BranchScoreMap,
  trend: TrajectoryTrend
): void {
  const effect = getTrendEffectValue(trend);

  if (effect > 0) {
    addBranchScore(scores, "attachment", effect * 1.3);
    addBranchScore(scores, "balanced", effect * 0.2);
  } else if (effect < 0) {
    addBranchScore(scores, "defense", Math.abs(effect) * 0.9);
    addBranchScore(scores, "survival", Math.abs(effect) * 0.5);
  }
}

/**
 * 根据“压力趋势”加权分支分数
 *
 * 逻辑：
 * - 压力上升 -> defense / survival 更容易形成
 * - 压力下降 -> recovery / balanced 更容易形成
 */
export function applyStressTrendToBranchScores(
  scores: BranchScoreMap,
  trend: TrajectoryTrend
): void {
  const effect = getTrendEffectValue(trend);

  if (effect > 0) {
    addBranchScore(scores, "defense", effect * 1.2);
    addBranchScore(scores, "survival", effect * 1.0);
  } else if (effect < 0) {
    addBranchScore(scores, "recovery", Math.abs(effect) * 1.0);
    addBranchScore(scores, "balanced", Math.abs(effect) * 0.4);
  }
}

/**
 * 根据“探索趋势”加权分支分数
 *
 * 逻辑：
 * - 探索上升 -> curiosity 更容易形成
 * - 探索下降 -> recovery / defense 稍微增加可能性
 */
export function applyExplorationTrendToBranchScores(
  scores: BranchScoreMap,
  trend: TrajectoryTrend
): void {
  const effect = getTrendEffectValue(trend);

  if (effect > 0) {
    addBranchScore(scores, "curiosity", effect * 1.4);
    addBranchScore(scores, "balanced", effect * 0.2);
  } else if (effect < 0) {
    addBranchScore(scores, "recovery", Math.abs(effect) * 0.5);
    addBranchScore(scores, "defense", Math.abs(effect) * 0.4);
  }
}

/**
 * 根据“依附趋势”加权分支分数
 *
 * 逻辑：
 * - 依附上升 -> attachment 更明显
 * - 依附下降 -> balanced 或 defense 略微增加
 */
export function applyAttachmentTrendToBranchScores(
  scores: BranchScoreMap,
  trend: TrajectoryTrend
): void {
  const effect = getTrendEffectValue(trend);

  if (effect > 0) {
    addBranchScore(scores, "attachment", effect * 1.5);
  } else if (effect < 0) {
    addBranchScore(scores, "balanced", Math.abs(effect) * 0.3);
    addBranchScore(scores, "defense", Math.abs(effect) * 0.3);
  }
}

/**
 * 根据“回避趋势”加权分支分数
 *
 * 逻辑：
 * - 回避上升 -> defense / survival 增强
 * - 回避下降 -> balanced / curiosity 略增强
 */
export function applyAvoidanceTrendToBranchScores(
  scores: BranchScoreMap,
  trend: TrajectoryTrend
): void {
  const effect = getTrendEffectValue(trend);

  if (effect > 0) {
    addBranchScore(scores, "defense", effect * 1.3);
    addBranchScore(scores, "survival", effect * 0.8);
  } else if (effect < 0) {
    addBranchScore(scores, "balanced", Math.abs(effect) * 0.4);
    addBranchScore(scores, "curiosity", Math.abs(effect) * 0.4);
  }
}

/* -------------------------------------------------------------------------- */
/* 四、基于历史事件的分支加权                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 根据单条历史事件，为分支分数加权
 *
 * 当前第一版采用“事件类型关键词匹配”的方式：
 * - 简单
 * - 直观
 * - 后续方便逐步增强
 *
 * 后面如果系统更复杂，
 * 可以改为更正式的事件映射表。
 */
export function applyHistoryEventToBranchScores(
  scores: BranchScoreMap,
  event: TimelineEventRecord
): void {
  const impact = event.impact ?? 0.1;
  const type = event.type;

  switch (type) {
    case "bonding":
    case "comforted":
    case "trust_gain":
      addBranchScore(scores, "attachment", impact * 1.2);
      break;

    case "disturbed":
    case "guarded_response":
      addBranchScore(scores, "defense", impact * 1.1);
      break;

    case "fed":
    case "rested":
      addBranchScore(scores, "recovery", impact * 0.9);
      break;

    case "behavior_shift": {
      const nextAction = event.payload?.nextAction;
      if (nextAction === "walking" || nextAction === "exploring") {
        addBranchScore(scores, "curiosity", impact * 0.8);
      }
      if (nextAction === "sleeping") {
        addBranchScore(scores, "recovery", impact * 0.4);
      }
      break;
    }

    case "state_shift": {
      const category = event.payload?.category;
      const nextLabel = event.payload?.nextLabel;

      if (category === "relational" && nextLabel === "attached") {
        addBranchScore(scores, "attachment", impact * 1.0);
      }

      if (
        (category === "emotional" && nextLabel === "alert") ||
        (category === "emotional" && nextLabel === "anxious")
      ) {
        addBranchScore(scores, "defense", impact * 0.9);
      }

      if (category === "physical" && nextLabel === "recovering") {
        addBranchScore(scores, "recovery", impact * 0.8);
      }

      if (category === "cognitive" && nextLabel === "curious") {
        addBranchScore(scores, "curiosity", impact * 0.9);
      }

      break;
    }

    case "born":
      addBranchScore(scores, "balanced", impact * 0.2);
      break;

    default:
      break;
  }
}

/**
 * 遍历所有历史记录并加权分支分数
 */
export function applyHistoryToBranchScores(
  scores: BranchScoreMap,
  history: TimelineEventRecord[]
): void {
  for (const event of history) {
    applyHistoryEventToBranchScores(scores, event);
  }
}

/* -------------------------------------------------------------------------- */
/* 五、综合计算                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 根据完整 LifeTrajectory 计算所有分支分数
 *
 * 计算顺序：
 * 1. 先创建默认分数
 * 2. 再根据趋势加权
 * 3. 再根据 history 事件补充加权
 *
 * 这样做的思路是：
 * - 趋势是“长期抽象方向”
 * - history 是“具体经历补充”
 * 两者结合更合理
 */
export function calculateBranchScores(
  trajectory: LifeTrajectory
): BranchScoreMap {
  const scores = createDefaultBranchScoreMap();

  applyTrustTrendToBranchScores(scores, trajectory.trustTrend);
  applyStressTrendToBranchScores(scores, trajectory.stressTrend);
  applyExplorationTrendToBranchScores(scores, trajectory.explorationTrend);
  applyAttachmentTrendToBranchScores(scores, trajectory.attachmentTrend);
  applyAvoidanceTrendToBranchScores(scores, trajectory.avoidanceTrend);

  applyHistoryToBranchScores(scores, trajectory.history);

  return scores;
}

/**
 * 选出当前得分最高的分支标签
 *
 * 规则：
 * - 分数最高者胜出
 * - 如果出现完全相同的高分，则按对象遍历顺序取前者
 *
 * 当前第一版这样已经够用。
 * 后续如果你要更细，可以加入：
 * - 最低阈值
 * - 平局打破规则
 * - “仍保持 balanced”的保守条件
 */
export function pickTopBranchTag(scores: BranchScoreMap): BranchTag {
  const entries = Object.entries(scores) as Array<[BranchTag, number]>;

  let bestBranch: BranchTag = "balanced";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [branch, score] of entries) {
    if (score > bestScore) {
      bestScore = score;
      bestBranch = branch;
    }
  }

  return bestBranch;
}

/**
 * 根据轨迹直接计算当前 branchTag
 *
 * 这是外部最常用的入口之一。
 */
export function calculateBranchTag(
  trajectory: LifeTrajectory
): BranchTag {
  const scores = calculateBranchScores(trajectory);
  return pickTopBranchTag(scores);
}

/**
 * 返回带有更新后 branchTag 的新轨迹对象
 *
 * 注意：
 * - 不直接修改原对象
 * - 返回的是新对象
 */
export function withCalculatedBranchTag(
  trajectory: LifeTrajectory
): LifeTrajectory {
  return {
    ...trajectory,
    branchTag: calculateBranchTag(trajectory),
  };
}