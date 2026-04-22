/**
 * AI-PET-WORLD
 * 时间线系统 - 状态分类器（第一版）
 *
 * ----------------------------------------------------------------------------
 * 【这个文件负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件专门负责把底层状态数值翻译成“结果层标签”。
 *
 * 它的核心职责是：
 * 1. 重新判断 emotional.label
 * 2. 重新判断 physical.label
 * 3. 重新判断 cognitive.label
 * 4. 重新判断 relational.label
 * 5. 重新判断 drive.primary
 * 6. 提供统一的状态分类收口方法
 *
 * ----------------------------------------------------------------------------
 * 【这个文件不负责什么？】
 * ----------------------------------------------------------------------------
 * 这个文件不负责：
 * - 更新状态数值
 * - 时间推进
 * - 事件处理
 * - fortune 修正
 * - 轨迹记录
 *
 * 它只是“结果层判断器”。
 */

import type {
  CognitiveLabel,
  CognitiveState,
  DriveState,
  EmotionalLabel,
  EmotionalState,
  PetState,
  PhysicalLabel,
  PhysicalState,
  PrimaryDrive,
  RelationalLabel,
  RelationalState,
} from "./state-types";

/* -------------------------------------------------------------------------- */
/* 一、情绪标签判断                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 判断情绪标签
 *
 * 输入：
 * - emotional 数值
 * - cognitive 数值（因为 stress / curiosity / awareness 会明显影响情绪结果层）
 *
 * 说明：
 * - 情绪标签不是单看 valence
 * - 还要看 arousal、stress、awareness、curiosity
 */
export function classifyEmotionalLabel(
  emotional: EmotionalState,
  cognitive: CognitiveState
): EmotionalLabel {
  if (cognitive.stress > 0.68 && emotional.arousal > 0.58) {
    return "anxious";
  }

  if (cognitive.awareness > 0.72 && emotional.arousal > 0.52) {
    return "alert";
  }

  if (emotional.arousal > 0.72 && emotional.valence >= 0.2) {
    return "excited";
  }

  if (emotional.valence < -0.35 && emotional.arousal < 0.45) {
    return "low";
  }

  if (emotional.valence < -0.2 && emotional.arousal > 0.55) {
    return "irritated";
  }

  if (cognitive.curiosity > 0.7) {
    return "curious";
  }

  if (emotional.valence > 0.4 && emotional.arousal < 0.5) {
    return "content";
  }

  if (emotional.valence > 0.15 && emotional.arousal < 0.4) {
    return "relaxed";
  }

  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* 二、生理标签判断                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 判断生理标签
 */
export function classifyPhysicalLabel(
  physical: PhysicalState
): PhysicalLabel {
  if (physical.health < 35) {
    return "weak";
  }

  if (physical.recovery > 0.72) {
    return "recovering";
  }

  if (physical.hunger > 68) {
    return "hungry";
  }

  if (physical.energy < 35) {
    return "tired";
  }

  if (physical.energy > 75 && physical.health > 75) {
    return "energetic";
  }

  return "stable";
}

/* -------------------------------------------------------------------------- */
/* 三、认知标签判断                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 判断认知标签
 */
export function classifyCognitiveLabel(
  cognitive: CognitiveState
): CognitiveLabel {
  if (cognitive.stress > 0.72) {
    return "stressed";
  }

  if (cognitive.stress > 0.55 && cognitive.curiosity < 0.3) {
    return "avoidant";
  }

  if (cognitive.curiosity > 0.7) {
    return "curious";
  }

  if (cognitive.focus > 0.72) {
    return "focused";
  }

  if (cognitive.awareness > 0.62) {
    return "observing";
  }

  if (cognitive.stress > 0.48) {
    return "hesitant";
  }

  return "idle";
}

/* -------------------------------------------------------------------------- */
/* 四、关系标签判断                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 判断关系标签
 */
export function classifyRelationalLabel(
  relational: RelationalState
): RelationalLabel {
  if (relational.attachment > 0.68 && relational.trust > 0.65) {
    return "attached";
  }

  if (relational.safety > 0.72 && relational.trust > 0.58) {
    return "secure";
  }

  if (relational.distance > 0.62) {
    return "distant";
  }

  if (relational.distance > 0.45 && relational.trust < 0.45) {
    return "guarded";
  }

  return "neutral";
}

/* -------------------------------------------------------------------------- */
/* 五、主驱动力判断                                                             */
/* -------------------------------------------------------------------------- */

/**
 * 判断主驱动力
 *
 * 规则：
 * - 从 rest / eat / explore / approach / avoid 中选最大值
 * - 给一个基础门槛，避免轻微波动就强行命中
 */
export function classifyPrimaryDrive(
  drive: DriveState,
  threshold: number = 0.2
): PrimaryDrive {
  const candidates: Array<[PrimaryDrive, number]> = [
    ["rest", drive.rest],
    ["eat", drive.eat],
    ["explore", drive.explore],
    ["approach", drive.approach],
    ["avoid", drive.avoid],
  ];

  let best: PrimaryDrive = "idle";
  let bestValue = threshold;

  for (const [name, value] of candidates) {
    if (value > bestValue) {
      best = name;
      bestValue = value;
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/* 六、单层状态标签重算                                                         */
/* -------------------------------------------------------------------------- */

/**
 * 重新分类 emotional
 */
export function classifyEmotionalState(
  emotional: EmotionalState,
  cognitive: CognitiveState
): EmotionalState {
  return {
    ...emotional,
    label: classifyEmotionalLabel(emotional, cognitive),
  };
}

/**
 * 重新分类 physical
 */
export function classifyPhysicalState(
  physical: PhysicalState
): PhysicalState {
  return {
    ...physical,
    label: classifyPhysicalLabel(physical),
  };
}

/**
 * 重新分类 cognitive
 */
export function classifyCognitiveState(
  cognitive: CognitiveState
): CognitiveState {
  return {
    ...cognitive,
    label: classifyCognitiveLabel(cognitive),
  };
}

/**
 * 重新分类 relational
 */
export function classifyRelationalState(
  relational: RelationalState
): RelationalState {
  return {
    ...relational,
    label: classifyRelationalLabel(relational),
  };
}

/**
 * 重新分类 drive
 */
export function classifyDriveState(
  drive: DriveState,
  threshold: number = 0.2
): DriveState {
  return {
    ...drive,
    primary: classifyPrimaryDrive(drive, threshold),
  };
}

/* -------------------------------------------------------------------------- */
/* 七、总状态分类收口                                                           */
/* -------------------------------------------------------------------------- */

/**
 * 把一整份 PetState 重新分类
 *
 * 使用场景：
 * - state-updater 更新完数值之后
 * - 页面想临时重算结果层标签
 * - 调试页想验证分类规则
 */
export function classifyPetState(
  state: PetState,
  options?: {
    driveThreshold?: number;
  }
): PetState {
  const nextEmotional = classifyEmotionalState(
    state.emotional,
    state.cognitive
  );

  const nextPhysical = classifyPhysicalState(state.physical);
  const nextCognitive = classifyCognitiveState(state.cognitive);
  const nextRelational = classifyRelationalState(state.relational);

  const nextDrive = classifyDriveState(
    state.drive,
    options?.driveThreshold ?? 0.2
  );

  return {
    emotional: nextEmotional,
    physical: nextPhysical,
    cognitive: nextCognitive,
    drive: nextDrive,
    relational: nextRelational,
  };
}