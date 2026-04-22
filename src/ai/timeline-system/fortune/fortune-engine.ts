/**
 * AI-PET-WORLD
 * 时间线系统 - 时序偏移引擎（第一版）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件专门负责根据“当前时间阶段”，生成基础版 TemporalInfluence。
 *
 * 当前第一版的目标非常明确：
 * 1. 根据 day / hour / world 节奏，生成一个基础阶段标签
 * 2. 根据阶段标签生成基础 modifiers
 * 3. 输出完整的 TemporalInfluence
 *
 * ----------------------------------------------------------------------------
 * 【这个文件当前不负责什么？】
 * ----------------------------------------------------------------------------
 * 当前第一版不负责：
 * - 真正的大运 / 流年 / 流月 / 流日计算
 * - 和先天人格的深度结合
 * - 和生命轨迹的深度结合
 * - 精细未来预测
 *
 * 这一轮先做“可运行的阶段偏移基础版”。
 *
 * ----------------------------------------------------------------------------
 * 【设计思路】
 * ----------------------------------------------------------------------------
 * 你当前项目里，fortune 不是拿来决定绝对命运的，
 * 而是拿来表示：
 *
 * “当前这个阶段，更容易放大什么倾向”
 *
 * 所以第一版先用：
 * - 日内节奏（hour）
 * - 短周期节奏（day）
 *
 * 来构建一个基础阶段偏移器。
 */

import type {
  FortuneBiasValue,
  FortuneModifierSet,
  FortunePhaseTag,
  FortuneProjection,
  FortuneSourceLayer,
  TemporalInfluence,
} from "./fortune-types";

/* -------------------------------------------------------------------------- */
/* 一、输入结构                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 构建当前时序偏移时的输入参数
 *
 * 当前第一版只吃最基础的世界时间信息。
 * 后续你可以逐步增加：
 * - birth info
 * - personality profile
 * - trajectory snapshot
 * - current state
 */
export interface BuildTemporalInfluenceInput {
  /**
   * 世界第几天
   */
  day: number;

  /**
   * 当前小时（建议 0 ~ 23）
   */
  hour: number;

  /**
   * 可选：当前时间段标签
   *
   * 例如来自 timeSystem：
   * - morning
   * - daytime
   * - evening
   * - night
   *
   * 当前第一版可选，不强依赖。
   */
  period?: string;
}

/**
 * 构建未来阶段预览时的输入参数
 *
 * 当前第一版只做非常基础的“下一阶段预估”。
 */
export interface BuildFortuneProjectionInput {
  day: number;
  hour: number;
  period?: string;
  title?: string;
}

/* -------------------------------------------------------------------------- */
/* 二、基础工具函数                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 创建单条偏移项
 *
 * 这样后面写 modifiers 时更整齐，也更统一。
 */
export function createFortuneBiasValue(
  source: FortuneSourceLayer,
  delta: number,
  reason?: string
): FortuneBiasValue {
  return {
    source,
    delta,
    reason,
  };
}

/**
 * 创建空修正集合
 *
 * 当前第一版用于：
 * - 先创建骨架
 * - 再按阶段往里填偏移项
 */
export function createEmptyFortuneModifierSet(): FortuneModifierSet {
  return {
    emotional: {},
    cognitive: {},
    drive: {},
    relational: {},
  };
}

/* -------------------------------------------------------------------------- */
/* 三、阶段判断逻辑                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 根据 hour 判断当前基础阶段标签
 *
 * 当前第一版采用“日内节奏 + 简单周期切换”的组合思路：
 *
 * 1. 先通过 hour 判断大致节奏：
 *    - 清晨 / 上午：更容易 growth / curiosity
 *    - 下午：更容易 stable / attachment
 *    - 傍晚：更容易 sensitive / withdrawal
 *    - 夜间：更容易 recovery
 *
 * 2. 再通过 day 做轻微周期扰动：
 *    - 每 6 天一个小周期
 *
 * 这样第一版就能有：
 * - 基础稳定性
 * - 轻微变化感
 * - 不会死板
 */
export function determineFortunePhaseTag(
  input: BuildTemporalInfluenceInput
): FortunePhaseTag {
  const dayCycle = input.day % 6;
  const hour = input.hour;

  // 夜间偏恢复
  if (hour >= 22 || hour < 5) {
    return "recovery_phase";
  }

  // 清晨到上午，更偏成长/探索
  if (hour >= 5 && hour < 11) {
    if (dayCycle === 1 || dayCycle === 2) {
      return "growth_phase";
    }
    return "stable_phase";
  }

  // 中午到下午，更偏平稳/关系建立
  if (hour >= 11 && hour < 17) {
    if (dayCycle === 3) {
      return "attachment_phase";
    }
    return "stable_phase";
  }

  // 傍晚，更容易敏感或收缩
  if (hour >= 17 && hour < 22) {
    if (dayCycle === 4) {
      return "withdrawal_phase";
    }
    return "sensitive_phase";
  }

  return "stable_phase";
}

/**
 * 根据阶段标签给一个基础阶段强度
 *
 * 当前第一版不做复杂计算，直接给每类阶段一个基础值。
 */
export function getBasePhaseStrength(
  phaseTag: FortunePhaseTag
): number {
  switch (phaseTag) {
    case "growth_phase":
      return 0.62;

    case "attachment_phase":
      return 0.56;

    case "sensitive_phase":
      return 0.58;

    case "withdrawal_phase":
      return 0.64;

    case "recovery_phase":
      return 0.68;

    case "stable_phase":
    default:
      return 0.35;
  }
}

/* -------------------------------------------------------------------------- */
/* 四、阶段 -> 偏移集合映射                                                     */
/* -------------------------------------------------------------------------- */

/**
 * 为某个数组字段安全追加偏移项
 *
 * 由于 modifiers 里的字段都是可选数组，
 * 所以这里统一做一下安全初始化。
 */
export function pushBiasValue(
  target: FortuneBiasValue[] | undefined,
  value: FortuneBiasValue
): FortuneBiasValue[] {
  if (!target) {
    return [value];
  }

  return [...target, value];
}

/**
 * 根据阶段标签，生成基础修正集合
 *
 * 当前第一版只做：
 * - emotional
 * - cognitive
 * - drive
 * - relational
 *
 * 不直接碰 physical。
 */
export function buildPhaseModifiers(
  phaseTag: FortunePhaseTag
): FortuneModifierSet {
  const modifiers = createEmptyFortuneModifierSet();

  switch (phaseTag) {
    case "growth_phase": {
      modifiers.cognitive!.curiosity = pushBiasValue(
        modifiers.cognitive!.curiosity,
        createFortuneBiasValue("current", 0.18, "当前阶段更容易放大探索兴趣。")
      );

      modifiers.drive!.explore = pushBiasValue(
        modifiers.drive!.explore,
        createFortuneBiasValue("current", 0.22, "当前阶段更容易推动探索驱动力。")
      );

      modifiers.emotional!.arousal = pushBiasValue(
        modifiers.emotional!.arousal,
        createFortuneBiasValue("current", 0.08, "当前阶段整体更偏活跃。")
      );

      break;
    }

    case "attachment_phase": {
      modifiers.relational!.trust = pushBiasValue(
        modifiers.relational!.trust,
        createFortuneBiasValue("current", 0.16, "当前阶段更容易增强信任感。")
      );

      modifiers.relational!.attachment = pushBiasValue(
        modifiers.relational!.attachment,
        createFortuneBiasValue("current", 0.2, "当前阶段更容易显化亲近倾向。")
      );

      modifiers.drive!.approach = pushBiasValue(
        modifiers.drive!.approach,
        createFortuneBiasValue("current", 0.18, "当前阶段更容易推动靠近行为。")
      );

      break;
    }

    case "sensitive_phase": {
      modifiers.emotional!.arousal = pushBiasValue(
        modifiers.emotional!.arousal,
        createFortuneBiasValue("current", 0.16, "当前阶段更容易放大紧张感与激活度。")
      );

      modifiers.cognitive!.awareness = pushBiasValue(
        modifiers.cognitive!.awareness,
        createFortuneBiasValue("current", 0.14, "当前阶段更容易增强环境感知。")
      );

      modifiers.cognitive!.stress = pushBiasValue(
        modifiers.cognitive!.stress,
        createFortuneBiasValue("current", 0.18, "当前阶段更容易放大认知压力。")
      );

      break;
    }

    case "withdrawal_phase": {
      modifiers.drive!.avoid = pushBiasValue(
        modifiers.drive!.avoid,
        createFortuneBiasValue("current", 0.22, "当前阶段更容易推动回避倾向。")
      );

      modifiers.relational!.distance = pushBiasValue(
        modifiers.relational!.distance,
        createFortuneBiasValue("current", 0.16, "当前阶段更容易保持距离。")
      );

      modifiers.cognitive!.stress = pushBiasValue(
        modifiers.cognitive!.stress,
        createFortuneBiasValue("current", 0.12, "当前阶段更容易保留警觉负担。")
      );

      break;
    }

    case "recovery_phase": {
      modifiers.drive!.rest = pushBiasValue(
        modifiers.drive!.rest,
        createFortuneBiasValue("current", 0.2, "当前阶段更容易推动休整与停留。")
      );

      modifiers.emotional!.stability = pushBiasValue(
        modifiers.emotional!.stability,
        createFortuneBiasValue("current", 0.16, "当前阶段更容易恢复情绪稳定。")
      );

      modifiers.cognitive!.stress = pushBiasValue(
        modifiers.cognitive!.stress,
        createFortuneBiasValue("current", -0.16, "当前阶段有助于缓和认知压力。")
      );

      modifiers.relational!.safety = pushBiasValue(
        modifiers.relational!.safety,
        createFortuneBiasValue("current", 0.1, "当前阶段更容易恢复安全感。")
      );

      break;
    }

    case "stable_phase":
    default: {
      modifiers.emotional!.stability = pushBiasValue(
        modifiers.emotional!.stability,
        createFortuneBiasValue("current", 0.08, "当前阶段整体较平稳。")
      );

      modifiers.relational!.safety = pushBiasValue(
        modifiers.relational!.safety,
        createFortuneBiasValue("current", 0.06, "当前阶段对稳定停留更友好。")
      );

      break;
    }
  }

  return modifiers;
}

/* -------------------------------------------------------------------------- */
/* 五、阶段摘要                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 根据阶段标签生成摘要
 *
 * 这个摘要会挂到 TemporalInfluence.summary，
 * 给 world 页面 / 调试页直接使用。
 */
export function buildPhaseSummary(
  phaseTag: FortunePhaseTag
): string {
  switch (phaseTag) {
    case "growth_phase":
      return "当前阶段更容易放大探索、活跃与向外接触的倾向。";

    case "attachment_phase":
      return "当前阶段更容易放大亲近、信任与建立连接的倾向。";

    case "sensitive_phase":
      return "当前阶段更容易放大警觉、敏感与对外界刺激的反应。";

    case "withdrawal_phase":
      return "当前阶段更容易放大收缩、保留与回避刺激的倾向。";

    case "recovery_phase":
      return "当前阶段更容易放大休整、恢复与重新稳定的倾向。";

    case "stable_phase":
    default:
      return "当前阶段整体较平稳，偏向维持状态与温和推进。";
  }
}

/* -------------------------------------------------------------------------- */
/* 六、统一对外入口                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 构建当前时序偏移
 *
 * 这是 fortune-engine 当前阶段最重要的统一入口。
 *
 * 输入：
 * - 当前世界时间
 *
 * 输出：
 * - 当前阶段标签
 * - 当前阶段强度
 * - 当前阶段摘要
 * - 当前阶段修正项
 */
export function buildTemporalInfluence(
  input: BuildTemporalInfluenceInput
): TemporalInfluence {
  const phaseTag = determineFortunePhaseTag(input);
  const phaseStrength = getBasePhaseStrength(phaseTag);
  const modifiers = buildPhaseModifiers(phaseTag);
  const summary = buildPhaseSummary(phaseTag);

  return {
    phaseTag,
    phaseStrength,
    summary,
    modifiers,
  };
}

/* -------------------------------------------------------------------------- */
/* 七、未来阶段预览（第一版）                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 简单推算“下一阶段时间”
 *
 
 * 简单推算“下一阶段时间
 *
 * 这样不会太复杂，但能给 future mapping 一个基础预览能力。
 */
export function getNextProjectionTime(
  day: number,
  hour: number
): { nextDay: number; nextHour: number } {
  let nextHour = hour + 6;
  let nextDay = day;

  if (nextHour >= 24) {
    nextHour -= 24;
    nextDay += 1;
  }

  return {
    nextDay,
    nextHour,
  };
}

/**
 * 构建下一阶段预览
 *
 * 注意：
 * 这不是绝对命运结果，
 * 只是“接下来更容易进入怎样的阶段”的预估。
 */
export function buildFortuneProjection(
  input: BuildFortuneProjectionInput
): FortuneProjection {
  const nextTime = getNextProjectionTime(input.day, input.hour);

  const projectedInfluence = buildTemporalInfluence({
    day: nextTime.nextDay,
    hour: nextTime.nextHour,
    period: input.period,
  });

  return {
    title: input.title ?? "下一阶段预估",
    phaseTag: projectedInfluence.phaseTag,
    phaseStrength: projectedInfluence.phaseStrength,
    summary: projectedInfluence.summary,
    projectedModifiers: projectedInfluence.modifiers,
  };
}