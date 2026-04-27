/**
 * 当前文件负责：让 AI 对世界刺激进行主观解释，并根据人格、状态与空间距离生成认知结果。
 */

import type {
  BuildCognitionInput,
  CognitionResult,
} from "./cognition-types"

function getTrait(
  traits: Record<string, number>,
  key: string,
  fallback = 50
): number {
  return traits[key] ?? fallback
}

function calculateStimulusDistance(
  input: BuildCognitionInput
): number | undefined {
  if (!input.petWorldPosition) {
    return undefined
  }

  const dx = input.stimulus.worldPosition.x - input.petWorldPosition.x
  const dy = input.stimulus.worldPosition.y - input.petWorldPosition.y

  return Math.round(Math.sqrt(dx * dx + dy * dy))
}

function applySpatialAwareness(
  input: BuildCognitionInput,
  result: CognitionResult
): CognitionResult {
  const distance = calculateStimulusDistance(input)

  if (distance === undefined) {
    return result
  }

  const near = distance <= input.stimulus.spatialRadius
  const far = distance >= input.stimulus.spatialRadius * 3

  let next: CognitionResult = {
    ...result,
    distanceToStimulus: distance,
  }

  if (near) {
    next = {
      ...next,
      curiosityLevel: Math.min(100, next.curiosityLevel + 8),
      stressLevel: Math.min(100, next.stressLevel + 4),
      emotionalShift: next.emotionalShift + 2,
    }

    if (
      input.stimulus.type === "shadow_motion" ||
      input.stimulus.type === "distant_sound"
    ) {
      next = {
        ...next,
        interpretation: "dangerous",
        reactionTendency:
          input.consciousness.caution >= 65 ? "avoid" : "observe",
        stressLevel: Math.min(100, next.stressLevel + 18),
        safetyFeeling: Math.max(0, next.safetyFeeling - 22),
        emotionalShift: next.emotionalShift - 8,
        summary: `${next.summary} 因为距离很近，它的身体反应变得更明显。`,
      }
    }

    if (
      input.stimulus.type === "warm_zone" ||
      input.stimulus.type === "quiet_zone" ||
      input.stimulus.type === "tree_presence" ||
      input.stimulus.type === "water_sound"
    ) {
      next = {
        ...next,
        reactionTendency:
          input.currentState.energy <= 55 ? "rest_nearby" : next.reactionTendency,
        safetyFeeling: Math.min(100, next.safetyFeeling + 10),
        stressLevel: Math.max(0, next.stressLevel - 6),
        summary: `${next.summary} 由于这个位置就在附近，它更容易把这里当成可停留的地方。`,
      }
    }

    if (
      (input.stimulus.type === "butterfly" ||
        input.stimulus.type === "entity_motion") &&
      input.currentState.energy >= 35 &&
      input.currentState.hunger < 80
    ) {
      next = {
        ...next,
        reactionTendency: "chase",
        curiosityLevel: Math.min(100, next.curiosityLevel + 12),
        summary: `${next.summary} 因为目标距离不远，它更容易产生跟过去的冲动。`,
      }
    }
  }

  if (far) {
    next = {
      ...next,
      curiosityLevel: Math.max(0, next.curiosityLevel - 8),
      stressLevel: Math.max(0, next.stressLevel - 4),
      emotionalShift: Math.round(next.emotionalShift * 0.6),
    }

    if (
      next.reactionTendency === "chase" ||
      next.reactionTendency === "rest_nearby" ||
      next.reactionTendency === "approach"
    ) {
      next = {
        ...next,
        reactionTendency: "observe",
        summary: `${next.summary} 但它感到那个变化离自己还有些远，所以暂时只是观察。`,
      }
    }
  }

  return next
}

function buildTreePresenceCognition(
  input: BuildCognitionInput
): CognitionResult {
  const caution =
    input.consciousness.caution +
    getTrait(input.personalityTraits, "cautious")

  const awareness =
    input.consciousness.environmentalAwareness +
    getTrait(input.personalityTraits, "observation")

  if (caution >= 125) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "safe",
      reactionTendency: "observe",
      curiosityLevel: 26,
      stressLevel: 8,
      safetyFeeling: 78,
      emotionalShift: 5,
      summary: "它停在树影边缘，像是在判断那里是否足够安全。",
    }
  }

  if (awareness >= 125) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "peaceful",
      reactionTendency: "observe",
      curiosityLevel: 34,
      stressLevel: 4,
      safetyFeeling: 82,
      emotionalShift: 8,
      summary: "它注意到附近的树影，把那片安静的阴影短暂记成了可观察的位置。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "peaceful",
    reactionTendency: "observe",
    curiosityLevel: 24,
    stressLevel: 3,
    safetyFeeling: 72,
    emotionalShift: 4,
    summary: "它看见附近落下的树影，注意力在那里停了一小会儿。",
  }
}

function buildFlowerScentCognition(
  input: BuildCognitionInput
): CognitionResult {
  const curiosity =
    input.consciousness.curiosity +
    getTrait(input.personalityTraits, "curiosity")

  const sensitivity =
    input.consciousness.emotionalSensitivity +
    getTrait(input.personalityTraits, "sensitivity")

  if (curiosity >= 125) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "interesting",
      reactionTendency: "observe",
      curiosityLevel: 58,
      stressLevel: 4,
      safetyFeeling: 68,
      emotionalShift: 8,
      summary: "它抬起头，似乎被空气里很淡的花香吸引了一下。",
    }
  }

  if (sensitivity >= 125) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "peaceful",
      reactionTendency: "observe",
      curiosityLevel: 32,
      stressLevel: 2,
      safetyFeeling: 76,
      emotionalShift: 10,
      summary: "那一点轻微花香让它的状态变得柔和了一些。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "interesting",
    reactionTendency: "observe",
    curiosityLevel: 38,
    stressLevel: 3,
    safetyFeeling: 66,
    emotionalShift: 5,
    summary: "它闻到了空气里很淡的花香，短暂把注意力转向花丛附近。",
  }
}

function buildWaterSoundCognition(
  input: BuildCognitionInput
): CognitionResult {
  const energy = input.currentState.energy

  const caution =
    input.consciousness.caution +
    getTrait(input.personalityTraits, "cautious")

  if (energy <= 45) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "comforting",
      reactionTendency: "rest_nearby",
      curiosityLevel: 28,
      stressLevel: 4,
      safetyFeeling: 84,
      emotionalShift: 10,
      summary: "它把注意力转向浅水边，像是被细小水声安抚了一点。",
    }
  }

  if (caution >= 130) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "mysterious",
      reactionTendency: "observe",
      curiosityLevel: 36,
      stressLevel: 12,
      safetyFeeling: 58,
      emotionalShift: 3,
      summary: "它听见浅水边细小的水声，先停下来确认那边有没有新的变化。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "peaceful",
    reactionTendency: "observe",
    curiosityLevel: 34,
    stressLevel: 2,
    safetyFeeling: 78,
    emotionalShift: 7,
    summary: "它短暂听了一会儿浅水边的细小水声，状态显得平稳了一些。",
  }
}

function buildEntityMotionCognition(
  input: BuildCognitionInput
): CognitionResult {
  const curiosity =
    input.consciousness.curiosity +
    getTrait(input.personalityTraits, "curiosity")

  const energy = input.currentState.energy
  const hunger = input.currentState.hunger

  if (curiosity >= 125 && energy >= 35 && hunger < 80) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "interesting",
      reactionTendency: "chase",
      curiosityLevel: 86,
      stressLevel: 8,
      safetyFeeling: 60,
      emotionalShift: 14,
      summary: "它追随着蝴蝶移动的方向，注意力明显变得更活跃。",
    }
  }

  if (energy < 35) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "interesting",
      reactionTendency: "observe",
      curiosityLevel: 42,
      stressLevel: 5,
      safetyFeeling: 56,
      emotionalShift: 4,
      summary: "它注意到蝴蝶轻轻移动，但现在只是安静地看着，没有立刻跟过去。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "interesting",
    reactionTendency: "observe",
    curiosityLevel: 62,
    stressLevel: 8,
    safetyFeeling: 58,
    emotionalShift: 8,
    summary: "它看见蝴蝶在附近轻轻移动，视线跟着那点变化偏了过去。",
  }
}

/* 保留原有刺激认知逻辑 */

function buildButterflyCognition(input: BuildCognitionInput): CognitionResult {
  const curiosity =
    input.consciousness.curiosity +
    getTrait(input.personalityTraits, "curiosity")

  const caution =
    input.consciousness.caution +
    getTrait(input.personalityTraits, "cautious")

  if (curiosity >= 130) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "interesting",
      reactionTendency: "chase",
      curiosityLevel: 92,
      stressLevel: 10,
      safetyFeeling: 58,
      emotionalShift: 18,
      summary: "它明显被那只轻快掠过的小蝴蝶吸引住了，像是很想跟过去看看。",
    }
  }

  if (caution >= 130) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "mysterious",
      reactionTendency: "observe",
      curiosityLevel: 48,
      stressLevel: 42,
      safetyFeeling: 35,
      emotionalShift: 6,
      summary: "它没有立刻靠近，只是先把注意力放在那只掠过的小蝴蝶身上。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "interesting",
    reactionTendency: "observe",
    curiosityLevel: 65,
    stressLevel: 12,
    safetyFeeling: 52,
    emotionalShift: 10,
    summary: "它留意到了附近掠过的小蝴蝶，像是对这点轻微变化产生了兴趣。",
  }
}

function buildShadowMotionCognition(
  input: BuildCognitionInput
): CognitionResult {
  const caution =
    input.consciousness.caution +
    getTrait(input.personalityTraits, "cautious")

  const emotionalSensitivity = input.consciousness.emotionalSensitivity

  if (caution >= 140) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "dangerous",
      reactionTendency: "avoid",
      curiosityLevel: 18,
      stressLevel: 82,
      safetyFeeling: 12,
      emotionalShift: -18,
      summary: "它对视线边缘那道模糊影子明显提高了警惕，像是本能地想先拉开一点距离。",
    }
  }

  if (emotionalSensitivity >= 70) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "mysterious",
      reactionTendency: "observe",
      curiosityLevel: 40,
      stressLevel: 48,
      safetyFeeling: 35,
      emotionalShift: -4,
      summary: "它开始留意夜晚环境中的那点模糊影子，没有立刻放松下来。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "ignore",
    reactionTendency: "ignore",
    curiosityLevel: 10,
    stressLevel: 8,
    safetyFeeling: 55,
    emotionalShift: 0,
    summary: "它没有继续在意那道一闪而过的模糊影子。",
  }
}

function buildQuietZoneCognition(input: BuildCognitionInput): CognitionResult {
  const emotionalStability = input.currentState.emotionalStability
  const energy = input.currentState.energy

  if (energy <= 35) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "comforting",
      reactionTendency: "rest_nearby",
      curiosityLevel: 22,
      stressLevel: 6,
      safetyFeeling: 88,
      emotionalShift: 16,
      summary: "它对那片更安静的区域产生了明显好感，像是想靠过去把自己放松下来。",
    }
  }

  if (emotionalStability >= 70) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "peaceful",
      reactionTendency: "observe",
      curiosityLevel: 18,
      stressLevel: 2,
      safetyFeeling: 82,
      emotionalShift: 8,
      summary: "它注意到附近那片更安静的区域，并对那种平稳气息产生了轻微好感。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "ignore",
    reactionTendency: "ignore",
    curiosityLevel: 6,
    stressLevel: 0,
    safetyFeeling: 52,
    emotionalShift: 0,
    summary: "它暂时没有把注意力停留在那片安静区域上。",
  }
}

function buildBreezeCognition(input: BuildCognitionInput): CognitionResult {
  const curiosity =
    input.consciousness.curiosity +
    getTrait(input.personalityTraits, "curiosity")

  const sensitivity =
    input.consciousness.emotionalSensitivity +
    getTrait(input.personalityTraits, "sensitivity")

  const energy = input.currentState.energy

  if (curiosity >= 125 && energy >= 45) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "interesting",
      reactionTendency: "observe",
      curiosityLevel: 62,
      stressLevel: 6,
      safetyFeeling: 60,
      emotionalShift: 8,
      summary: "它被空气里那阵轻微的风勾起了些兴趣，像是想再多确认一下周围的变化。",
    }
  }

  if (sensitivity >= 130) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "peaceful",
      reactionTendency: "observe",
      curiosityLevel: 34,
      stressLevel: 4,
      safetyFeeling: 72,
      emotionalShift: 10,
      summary: "那阵轻微的风让它的状态稍微松开了一些，像是短暂感到了环境的流动。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "ignore",
    reactionTendency: "ignore",
    curiosityLevel: 12,
    stressLevel: 2,
    safetyFeeling: 58,
    emotionalShift: 2,
    summary: "它感受到了那阵轻微的风，但没有因此停下自己的节奏。",
  }
}

function buildTemperatureDropCognition(
  input: BuildCognitionInput
): CognitionResult {
  const sensitivity =
    input.consciousness.emotionalSensitivity +
    getTrait(input.personalityTraits, "sensitivity")

  const caution =
    input.consciousness.caution +
    getTrait(input.personalityTraits, "cautious")

  const energy = input.currentState.energy

  if (energy <= 40) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "annoying",
      reactionTendency: "rest_nearby",
      curiosityLevel: 10,
      stressLevel: 26,
      safetyFeeling: 36,
      emotionalShift: -6,
      summary: "周围温度慢慢降下来后，它像是更想去找一个让自己舒服点的位置待着。",
    }
  }

  if (caution >= 130 || sensitivity >= 130) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "mysterious",
      reactionTendency: "observe",
      curiosityLevel: 20,
      stressLevel: 28,
      safetyFeeling: 40,
      emotionalShift: -4,
      summary: "它留意到了周围温度的细微下降，像是开始重新评估此刻环境是否还足够安稳。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "annoying",
    reactionTendency: "observe",
    curiosityLevel: 12,
    stressLevel: 18,
    safetyFeeling: 46,
    emotionalShift: -2,
    summary: "它察觉到周围慢慢有些发凉，状态里多了一点轻微的不适感。",
  }
}

function buildWarmZoneCognition(input: BuildCognitionInput): CognitionResult {
  const energy = input.currentState.energy
  const stability = input.currentState.emotionalStability

  const comfortSeeking =
    100 - input.consciousness.caution +
    getTrait(input.personalityTraits, "comfort")

  if (energy <= 55 || comfortSeeking >= 120) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "comforting",
      reactionTendency: "rest_nearby",
      curiosityLevel: 16,
      stressLevel: 2,
      safetyFeeling: 86,
      emotionalShift: 14,
      summary: "它对那个更温暖的角落明显产生了好感，像是想靠过去让自己待得更舒服一些。",
    }
  }

  if (stability >= 70) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "peaceful",
      reactionTendency: "observe",
      curiosityLevel: 12,
      stressLevel: 1,
      safetyFeeling: 78,
      emotionalShift: 8,
      summary: "它注意到了那个更温暖的角落，并把它视作一个让状态更安稳的地方。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "comforting",
    reactionTendency: "observe",
    curiosityLevel: 10,
    stressLevel: 4,
    safetyFeeling: 68,
    emotionalShift: 6,
    summary: "它察觉到某个角落比周围更温暖，像是把那里记成了一个更舒服的位置。",
  }
}

function buildFallingLeafCognition(
  input: BuildCognitionInput
): CognitionResult {
  const curiosity =
    input.consciousness.curiosity +
    getTrait(input.personalityTraits, "curiosity")

  const caution =
    input.consciousness.caution +
    getTrait(input.personalityTraits, "cautious")

  if (curiosity >= 125) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "interesting",
      reactionTendency: "observe",
      curiosityLevel: 64,
      stressLevel: 8,
      safetyFeeling: 58,
      emotionalShift: 8,
      summary: "它被那片缓慢飘落的叶子吸引了一下，像是短暂把注意力跟了过去。",
    }
  }

  if (caution >= 130) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "mysterious",
      reactionTendency: "observe",
      curiosityLevel: 26,
      stressLevel: 18,
      safetyFeeling: 44,
      emotionalShift: 2,
      summary: "它没有贸然靠近，只是先盯着那片缓慢落下的叶子看了一会儿。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "interesting",
    reactionTendency: "observe",
    curiosityLevel: 40,
    stressLevel: 10,
    safetyFeeling: 50,
    emotionalShift: 4,
    summary: "它留意到了那片从上方缓慢飘落的叶子，像是被这点小变化牵动了一下注意力。",
  }
}

function buildDistantSoundCognition(
  input: BuildCognitionInput
): CognitionResult {
  const caution =
    input.consciousness.caution +
    getTrait(input.personalityTraits, "cautious")

  const awareness =
    input.consciousness.environmentalAwareness +
    getTrait(input.personalityTraits, "alertness")

  const stability = input.currentState.emotionalStability

  if (caution >= 125 || awareness >= 130) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "mysterious",
      reactionTendency: "observe",
      curiosityLevel: 30,
      stressLevel: 30,
      safetyFeeling: 38,
      emotionalShift: -2,
      summary: "远处那点不太清晰的动静让它重新把注意力提了起来，像是在判断那边到底发生了什么。",
    }
  }

  if (stability >= 70) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "interesting",
      reactionTendency: "observe",
      curiosityLevel: 42,
      stressLevel: 8,
      safetyFeeling: 56,
      emotionalShift: 4,
      summary: "远处那点模糊动静让它短暂留神了一下，但还不足以让它立刻紧张起来。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "mysterious",
    reactionTendency: "observe",
    curiosityLevel: 26,
    stressLevel: 16,
    safetyFeeling: 48,
    emotionalShift: 2,
    summary: "它听见远处传来一点不太清晰的动静，注意力因此向那边偏过去了一下。",
  }
}

function buildLightShiftCognition(
  input: BuildCognitionInput
): CognitionResult {
  const curiosity =
    input.consciousness.curiosity +
    getTrait(input.personalityTraits, "curiosity")

  const sensitivity =
    input.consciousness.emotionalSensitivity +
    getTrait(input.personalityTraits, "sensitivity")

  if (curiosity >= 125) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "interesting",
      reactionTendency: "observe",
      curiosityLevel: 52,
      stressLevel: 6,
      safetyFeeling: 58,
      emotionalShift: 6,
      summary: "地面上那点短暂变化的光影让它多看了一会儿，像是想确认变化从哪里来。",
    }
  }

  if (sensitivity >= 130) {
    return {
      stimulusId: input.stimulus.id,
      stimulusType: input.stimulus.type,
      interpretation: "peaceful",
      reactionTendency: "observe",
      curiosityLevel: 24,
      stressLevel: 2,
      safetyFeeling: 70,
      emotionalShift: 8,
      summary: "那点轻微变化的光影让它短暂安静下来，像是被环境表面的流动吸引住了。",
    }
  }

  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "ignore",
    reactionTendency: "ignore",
    curiosityLevel: 10,
    stressLevel: 2,
    safetyFeeling: 56,
    emotionalShift: 2,
    summary: "它察觉到地面上的光影有过短暂变化，但没有继续停留太久。",
  }
}

function buildGenericCognition(input: BuildCognitionInput): CognitionResult {
  return {
    stimulusId: input.stimulus.id,
    stimulusType: input.stimulus.type,
    interpretation: "interesting",
    reactionTendency: "observe",
    curiosityLevel: 40,
    stressLevel: 10,
    safetyFeeling: 50,
    emotionalShift: 4,
    summary: "它注意到了世界中的某种变化。",
  }
}

export function buildStimulusCognition(
  input: BuildCognitionInput
): CognitionResult {
  let baseResult: CognitionResult

  switch (input.stimulus.type) {
    case "tree_presence":
      baseResult = buildTreePresenceCognition(input)
      break

    case "flower_scent":
      baseResult = buildFlowerScentCognition(input)
      break

    case "water_sound":
      baseResult = buildWaterSoundCognition(input)
      break

    case "entity_motion":
      baseResult = buildEntityMotionCognition(input)
      break

    case "butterfly":
      baseResult = buildButterflyCognition(input)
      break

    case "shadow_motion":
      baseResult = buildShadowMotionCognition(input)
      break

    case "quiet_zone":
      baseResult = buildQuietZoneCognition(input)
      break

    case "breeze":
      baseResult = buildBreezeCognition(input)
      break

    case "temperature_drop":
      baseResult = buildTemperatureDropCognition(input)
      break

    case "warm_zone":
      baseResult = buildWarmZoneCognition(input)
      break

    case "falling_leaf":
      baseResult = buildFallingLeafCognition(input)
      break

    case "distant_sound":
      baseResult = buildDistantSoundCognition(input)
      break

    case "light_shift":
      baseResult = buildLightShiftCognition(input)
      break

    default:
      baseResult = buildGenericCognition(input)
      break
  }

  return applySpatialAwareness(input, baseResult)
}