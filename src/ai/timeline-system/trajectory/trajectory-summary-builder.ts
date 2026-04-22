/**
 * AI-PET-WORLD
 * 时间线系统 - 生命轨迹摘要构建器（第一版）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件专门负责把 LifeTrajectory 转成“可读摘要”。
 *
 * 它的核心职责是：
 * 1. 根据 branchTag 生成基础路径描述
 * 2. 根据趋势补充长期变化描述
 * 3. 根据最近 history 补充近期动态说明
 * 4. 输出适合 world 页面 / 调试页 / 后台查看的摘要文本
 *
 * ----------------------------------------------------------------------------
 * 【这个文件不负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件不负责：
 * - 写入 history
 * - 计算趋势
 * - 计算 branchTag
 * - 更新状态
 * - 计算 fortune
 *
 * 它只是“把轨迹翻译成能读懂的话”。
 */

import type {
  BranchTag,
  LifeTrajectory,
  TimelineEventRecord,
  TrajectoryTrend,
} from "./trajectory-types";

/* -------------------------------------------------------------------------- */
/* 一、基础配置                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 默认最近事件观察窗口
 *
 * 用于摘要中“近期动态”部分。
 * 当前第一版默认只看最近 6 条记录。
 */
export const DEFAULT_RECENT_HISTORY_WINDOW = 6;

/**
 * 趋势强度阈值
 *
 * 低于这个值时，不主动写进摘要，避免把很弱的趋势也写出来导致噪音太大。
 */
export const DEFAULT_TREND_VISIBILITY_THRESHOLD = 0.2;

/* -------------------------------------------------------------------------- */
/* 二、分支基础摘要                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 根据 branchTag 获取基础摘要
 *
 * 这是轨迹摘要的第一层：
 * 当前这条生命线，大方向更像什么。
 */
export function getBranchBaseSummary(branchTag: BranchTag): string {
  switch (branchTag) {
    case "attachment":
      return "当前生命线更偏向亲近、依附与建立连接的发展路径。";

    case "defense":
      return "当前生命线更偏向警觉、防御与回避刺激的发展路径。";

    case "curiosity":
      return "当前生命线更偏向探索、接触世界与主动观察的发展路径。";

    case "recovery":
      return "当前生命线更偏向修整、恢复与重新稳定的发展路径。";

    case "survival":
      return "当前生命线更偏向应对压力、维持状态与基本生存的发展路径。";

    case "balanced":
    default:
      return "当前生命线整体仍较平衡，尚未完全收束到单一发展路径。";
  }
}

/* -------------------------------------------------------------------------- */
/* 三、趋势摘要                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 判断某条趋势是否值得写进摘要
 *
 * 规则：
 * - strength >= threshold 才输出
 */
export function isTrendVisible(
  trend: TrajectoryTrend,
  threshold: number = DEFAULT_TREND_VISIBILITY_THRESHOLD
): boolean {
  return trend.strength >= threshold;
}

/**
 * 根据单条趋势生成可读描述
 *
 * 参数说明：
 * - name: 趋势名称中文
 * - risingText: 上升时的描述
 * - fallingText: 下降时的描述
 *
 * 注意：
 * stable 默认不写，因为“稳定”通常不如升降有信息量。
 */
export function buildSingleTrendSummary(
  name: string,
  trend: TrajectoryTrend,
  risingText: string,
  fallingText: string,
  threshold: number = DEFAULT_TREND_VISIBILITY_THRESHOLD
): string | null {
  if (!isTrendVisible(trend, threshold)) {
    return null;
  }

  if (trend.direction === "rising") {
    return `${name}${risingText}`;
  }

  if (trend.direction === "falling") {
    return `${name}${fallingText}`;
  }

  return null;
}

/**
 * 构建轨迹趋势摘要列表
 *
 * 这一步负责把多个 trend 转成一组可读句子。
 */
export function buildTrendSummaryParts(
  trajectory: LifeTrajectory,
  threshold: number = DEFAULT_TREND_VISIBILITY_THRESHOLD
): string[] {
  const parts: Array<string | null> = [
    buildSingleTrendSummary(
      "信任",
      trajectory.trustTrend,
      "正在逐渐增强。",
      "正在逐渐下降。",
      threshold
    ),

    buildSingleTrendSummary(
      "长期压力",
      trajectory.stressTrend,
      "正在持续上升。",
      "正在逐渐缓和。",
      threshold
    ),

    buildSingleTrendSummary(
      "探索意愿",
      trajectory.explorationTrend,
      "正在逐步增强。",
      "正在逐渐收缩。",
      threshold
    ),

    buildSingleTrendSummary(
      "依附倾向",
      trajectory.attachmentTrend,
      "正在慢慢形成。",
      "正在逐渐减弱。",
      threshold
    ),

    buildSingleTrendSummary(
      "回避倾向",
      trajectory.avoidanceTrend,
      "正在变得更明显。",
      "正在逐渐减弱。",
      threshold
    ),
  ];

  return parts.filter((part): part is string => Boolean(part));
}

/* -------------------------------------------------------------------------- */
/* 四、近期历史摘要                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 获取最近若干条历史记录
 */
export function getRecentTimelineHistory(
  history: TimelineEventRecord[],
  windowSize: number = DEFAULT_RECENT_HISTORY_WINDOW
): TimelineEventRecord[] {
  if (history.length <= windowSize) {
    return history;
  }

  return history.slice(history.length - windowSize);
}

/**
 * 统计最近事件类型出现次数
 *
 * 作用：
 * - 帮助摘要判断“最近更偏什么动态”
 */
export function countRecentEventTypes(
  history: TimelineEventRecord[]
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of history) {
    result[item.type] = (result[item.type] ?? 0) + 1;
  }

  return result;
}

/**
 * 根据最近事件类型分布，构建近期动态摘要
 *
 * 当前第一版先用简单规则：
 * - 如果 behavior_shift 多 -> 最近行为变化频繁
 * - 如果 state_shift 多 -> 最近状态波动较明显
 * - 如果 bonding / comforted 多 -> 最近关系性正向互动增多
 * - 如果 disturbed / guarded_response 多 -> 最近警觉/受扰事件增多
 */
export function buildRecentHistorySummary(
  history: TimelineEventRecord[],
  windowSize: number = DEFAULT_RECENT_HISTORY_WINDOW
): string | null {
  const recent = getRecentTimelineHistory(history, windowSize);

  if (recent.length === 0) {
    return null;
  }

  const counts = countRecentEventTypes(recent);

  const behaviorShiftCount = counts["behavior_shift"] ?? 0;
  const stateShiftCount = counts["state_shift"] ?? 0;
  const bondingCount =
    (counts["bonding"] ?? 0) +
    (counts["comforted"] ?? 0) +
    (counts["trust_gain"] ?? 0);
  const disturbedCount =
    (counts["disturbed"] ?? 0) +
    (counts["guarded_response"] ?? 0);

  if (disturbedCount >= 2) {
    return "近期更常出现受扰与警觉相关的事件，生命线有向防御侧收缩的迹象。";
  }

  if (bondingCount >= 2) {
    return "近期关系性正向互动有所增加，生命线正在积累更多亲近与信任痕迹。";
  }

  if (behaviorShiftCount >= 3) {
    return "近期行为变化较为频繁，说明当前生命线仍处于较明显的调整过程中。";
  }

  if (stateShiftCount >= 3) {
    return "近期状态波动较明显，说明外部事件正在持续影响当前生命线。";
  }

  return "近期生命线仍在缓慢积累变化，但尚未出现非常强烈的单一转折信号。";
}

/* -------------------------------------------------------------------------- */
/* 五、总摘要构建                                                               */
/* -------------------------------------------------------------------------- */

/**
 * 构建生命轨迹摘要
 *
 * 输出顺序：
 * 1. 分支基础摘要
 * 2. 趋势摘要
 * 3. 近期动态摘要
 *
 * 返回一段完整字符串。
 */
export function buildTrajectorySummary(
  trajectory: LifeTrajectory,
  options?: {
    trendVisibilityThreshold?: number;
    recentHistoryWindow?: number;
  }
): string {
  const trendThreshold =
    options?.trendVisibilityThreshold ?? DEFAULT_TREND_VISIBILITY_THRESHOLD;

  const recentWindow =
    options?.recentHistoryWindow ?? DEFAULT_RECENT_HISTORY_WINDOW;

  const summaryParts: string[] = [];

  // 第一段：生命线当前大方向
  summaryParts.push(getBranchBaseSummary(trajectory.branchTag));

  // 第二段：长期趋势
  const trendParts = buildTrendSummaryParts(trajectory, trendThreshold);
  if (trendParts.length > 0) {
    summaryParts.push(`长期趋势上，${trendParts.join("")}`);
  }

  // 第三段：近期动态
  const recentSummary = buildRecentHistorySummary(
    trajectory.history,
    recentWindow
  );
  if (recentSummary) {
    summaryParts.push(recentSummary);
  }

  return summaryParts.join(" ");
}

/**
 * 返回带有更新后 summary 的新轨迹对象
 *
 * 注意：
 * - 不直接修改原对象
 * - 返回新对象
 */
export function withBuiltTrajectorySummary(
  trajectory: LifeTrajectory,
  options?: {
    trendVisibilityThreshold?: number;
    recentHistoryWindow?: number;
  }
): LifeTrajectory {
  return {
    ...trajectory,
    summary: buildTrajectorySummary(trajectory, options),
  };
}