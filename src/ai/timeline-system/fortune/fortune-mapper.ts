/**
 * AI-PET-WORLD
 * 时间线系统 - 时序偏移结果映射器（第一版）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件专门负责把 fortune-engine 输出的 TemporalInfluence，
 * 翻译成更适合外部系统直接使用的结果层结构。
 *
 * 它的核心职责是：
 * 1. 把内部 phaseTag 翻译成可读阶段名称
 * 2. 提取当前阶段最明显的偏向重点
 * 3. 输出适合 world 页面 / 调试页 / future mapping 的 fortune 展示结果
 *
 * ----------------------------------------------------------------------------
 * 【这个文件不负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件不负责：
 * - 计算 phaseTag
 * - 计算 modifiers
 * - 更新状态
 * - 计算未来轨迹
 *
 * 它只是“结果翻译层”。
 */

import type {
  FortuneBiasValue,
  FortuneModifierSet,
  FortunePhaseTag,
  FortuneProjection,
  TemporalInfluence,
} from "./fortune-types";

/* -------------------------------------------------------------------------- */
/* 一、结果层类型                                                               */
/* -------------------------------------------------------------------------- */

/**
 * 单条阶段重点说明
 *
 * 用于表达：
 * 当前这个阶段最明显正在放大的方向是什么。
 */
export interface FortuneFocusItem {
  /**
   * 重点键名
   *
   * 例如：
   * - "explore"
   * - "stress"
   * - "trust"
   * - "rest"
   */
  key: string;

  /**
   * 所属层级
   *
   * 例如：
   * - "emotional"
   * - "cognitive"
   * - "drive"
   * - "relational"
   */
  category: string;

  /**
   * 累计偏移值
   *
   * 正数表示增强，负数表示压低。
   */
  totalDelta: number;

  /**
   * 可读说明
   *
   * 例如：
   * - "更容易探索与向外接触"
   * - "更容易感到警觉与紧张"
   */
  label: string;
}

/**
 * 当前 fortune 的结果层结构
 *
 * 这个结构更适合：
 * - world 页面展示
 * - 调试页展示
 * - future mapping 辅助使用
 */
export interface FortuneDisplayResult {
  /**
   * 原始阶段标签
   */
  phaseTag: FortunePhaseTag;

  /**
   * 当前阶段中文名称
   */
  phaseName: string;

  /**
   * 当前阶段强度
   */
  phaseStrength: number;

  /**
   * 原始摘要
   */
  summary: string;

  /**
   * 当前最明显的几个阶段偏向
   */
  focus: FortuneFocusItem[];

  /**
   * 更短的一句话概括
   *
   * 用于 world 页简洁显示。
   */
  shortSummary: string;
}

/**
 * 未来预览结果层结构
 */
export interface FortuneProjectionDisplayResult {
  /**
   * 预览标题
   */
  title: string;

  /**
   * 阶段标签
   */
  phaseTag: FortunePhaseTag;

  /**
   * 阶段中文名称
   */
  phaseName: string;

  /**
   * 阶段强度
   */
  phaseStrength: number;

  /**
   * 预览摘要
   */
  summary: string;

  /**
   * 预计重点偏向
   */
  focus: FortuneFocusItem[];

  /**
   * 简短概括
   */
  shortSummary: string;
}

/* -------------------------------------------------------------------------- */
/* 二、阶段标签映射                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 把内部阶段标签映射成中文名称
 */
export function mapFortunePhaseTagToName(
  phaseTag: FortunePhaseTag
): string {
  switch (phaseTag) {
    case "growth_phase":
      return "成长扩张阶段";

    case "attachment_phase":
      return "亲近依附阶段";

    case "sensitive_phase":
      return "敏感波动阶段";

    case "withdrawal_phase":
      return "收缩回避阶段";

    case "recovery_phase":
      return "修整恢复阶段";

    case "stable_phase":
    default:
      return "平稳阶段";
  }
}

/**
 * 根据阶段标签给一句简短概括
 *
 * 用于：
 * - world 页面
 * - 小卡片展示
 */
export function mapFortunePhaseTagToShortSummary(
  phaseTag: FortunePhaseTag
): string {
  switch (phaseTag) {
    case "growth_phase":
      return "当前更容易向外探索与扩张。";

    case "attachment_phase":
      return "当前更容易亲近与建立连接。";

    case "sensitive_phase":
      return "当前更容易放大敏感与警觉反应。";

    case "withdrawal_phase":
      return "当前更容易保留、收缩与回避刺激。";

    case "recovery_phase":
      return "当前更容易休整与恢复稳定。";

    case "stable_phase":
    default:
      return "当前整体偏平稳推进。";
  }
}

/* -------------------------------------------------------------------------- */
/* 三、偏移项提取与合并                                                         */
/* -------------------------------------------------------------------------- */

/**
 * 计算单组偏移数组的总 delta
 *
 * 例如：
 * - [ +0.1, +0.2, -0.05 ] => 0.25
 */
export function sumBiasDelta(values?: FortuneBiasValue[]): number {
  if (!values || values.length === 0) {
    return 0;
  }

  return values.reduce((total, item) => total + item.delta, 0);
}

/**
 * 根据分类 + key + delta 生成可读 label
 *
 * 当前第一版先做一套明确但不复杂的映射。
 * 后续如果你要更精细，可以拆到独立配置表里。
 */
export function buildFortuneFocusLabel(
  category: string,
  key: string,
  totalDelta: number
): string {
  const isPositive = totalDelta >= 0;

  if (category === "drive") {
    if (key === "explore") {
      return isPositive ? "更容易探索与向外接触" : "探索意愿更容易被压低";
    }
    if (key === "approach") {
      return isPositive ? "更容易靠近熟悉对象" : "靠近倾向更容易减弱";
    }
    if (key === "avoid") {
      return isPositive ? "更容易回避刺激与保持距离" : "回避倾向更容易减弱";
    }
    if (key === "rest") {
      return isPositive ? "更容易停下休整与恢复" : "休整倾向更容易减弱";
    }
    if (key === "eat") {
      return isPositive ? "进食驱动力更容易增强" : "进食驱动力更容易减弱";
    }
  }

  if (category === "cognitive") {
    if (key === "awareness") {
      return isPositive ? "更容易提高对环境的感知与警觉" : "环境感知更容易放松下来";
    }
    if (key === "curiosity") {
      return isPositive ? "更容易对周围产生探索兴趣" : "探索兴趣更容易减弱";
    }
    if (key === "stress") {
      return isPositive ? "更容易积累认知压力与紧张感" : "认知压力更容易得到缓和";
    }
    if (key === "focus") {
      return isPositive ? "更容易集中注意与持续当前行为" : "注意力更容易分散";
    }
  }

  if (category === "emotional") {
    if (key === "arousal") {
      return isPositive ? "情绪更容易被激活与放大" : "情绪更容易趋于平缓";
    }
    if (key === "stability") {
      return isPositive ? "情绪更容易保持稳定" : "情绪更容易产生波动";
    }
    if (key === "valence") {
      return isPositive ? "整体情绪更容易偏向舒展与积极" : "整体情绪更容易偏向收缩与低落";
    }
  }

  if (category === "relational") {
    if (key === "trust") {
      return isPositive ? "更容易建立信任感" : "信任感更容易降低";
    }
    if (key === "attachment") {
      return isPositive ? "更容易形成亲近与依附倾向" : "亲近倾向更容易减弱";
    }
    if (key === "distance") {
      return isPositive ? "更容易保持保留与距离感" : "距离感更容易减弱";
    }
    if (key === "safety") {
      return isPositive ? "更容易恢复安全感与安定感" : "安全感更容易下降";
    }
    if (key === "familiarity") {
      return isPositive ? "更容易对环境产生熟悉感" : "熟悉感更容易减弱";
    }
  }

  return isPositive ? `${category}.${key} 更容易增强` : `${category}.${key} 更容易减弱`;
}

/**
 * 从单个分类对象里提取 focus 项
 *
 * 例如从 emotional / cognitive / drive / relational 中分别提取。
 */
export function extractFocusItemsFromCategory(
  category: string,
  map?: Record<string, FortuneBiasValue[]>
): FortuneFocusItem[] {
  if (!map) {
    return [];
  }

  const result: FortuneFocusItem[] = [];

  for (const [key, values] of Object.entries(map)) {
    const totalDelta = sumBiasDelta(values);

    if (totalDelta === 0) {
      continue;
    }

    result.push({
      category,
      key,
      totalDelta,
      label: buildFortuneFocusLabel(category, key, totalDelta),
    });
  }

  return result;
}

/**
 * 从 modifiers 中提取全部 focus 项
 */
export function extractFortuneFocusItems(
  modifiers: FortuneModifierSet
): FortuneFocusItem[] {
  return [
    ...extractFocusItemsFromCategory("emotional", modifiers.emotional as Record<string, FortuneBiasValue[]> | undefined),
    ...extractFocusItemsFromCategory("cognitive", modifiers.cognitive as Record<string, FortuneBiasValue[]> | undefined),
    ...extractFocusItemsFromCategory("drive", modifiers.drive as Record<string, FortuneBiasValue[]> | undefined),
    ...extractFocusItemsFromCategory("relational", modifiers.relational as Record<string, FortuneBiasValue[]> | undefined),
  ];
}

/**
 * 对 focus 项排序
 *
 * 当前规则：
 * - 按 |totalDelta| 从大到小排
 *
 * 理由：
 * - 先展示影响最明显的重点
 */
export function sortFortuneFocusItems(
  items: FortuneFocusItem[]
): FortuneFocusItem[] {
  return [...items].sort(
    (a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta)
  );
}

/**
 * 只保留前几个最重要的 focus 项
 *
 * 默认取前 3 个。
 */
export function pickTopFortuneFocusItems(
  items: FortuneFocusItem[],
  topN: number = 3
): FortuneFocusItem[] {
  return sortFortuneFocusItems(items).slice(0, topN);
}

/* -------------------------------------------------------------------------- */
/* 四、总结果构建                                                               */
/* -------------------------------------------------------------------------- */

/**
 * 把 TemporalInfluence 映射成更适合展示的结果层
 */
export function mapTemporalInfluenceToDisplayResult(
  influence: TemporalInfluence,
  options?: {
    topN?: number;
  }
): FortuneDisplayResult {
  const allFocus = extractFortuneFocusItems(influence.modifiers);
  const focus = pickTopFortuneFocusItems(allFocus, options?.topN ?? 3);

  return {
    phaseTag: influence.phaseTag,
    phaseName: mapFortunePhaseTagToName(influence.phaseTag),
    phaseStrength: influence.phaseStrength,
    summary: influence.summary,
    focus,
    shortSummary: mapFortunePhaseTagToShortSummary(influence.phaseTag),
  };
}

/**
 * 把 FortuneProjection 映射成展示结果
 */
export function mapFortuneProjectionToDisplayResult(
  projection: FortuneProjection,
  options?: {
    topN?: number;
  }
): FortuneProjectionDisplayResult {
  const allFocus = extractFortuneFocusItems(
    projection.projectedModifiers ?? {}
  );
  const focus = pickTopFortuneFocusItems(allFocus, options?.topN ?? 3);

  return {
    title: projection.title,
    phaseTag: projection.phaseTag,
    phaseName: mapFortunePhaseTagToName(projection.phaseTag),
    phaseStrength: projection.phaseStrength,
    summary: projection.summary,
    focus,
    shortSummary: mapFortunePhaseTagToShortSummary(projection.phaseTag),
  };
}