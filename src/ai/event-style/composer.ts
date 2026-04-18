import type {
  PetActionEventInput,
  PetEventStyleInput,
  PetMoodEventInput
} from "./schema"

/**
 * 强度等级
 */
type IntensityLevel = "low" | "medium" | "high"

/**
 * 主风格
 */
type PrimaryTone =
  | "calm"
  | "active"
  | "stable"
  | "sensitive"
  | "balanced"

/**
 * 获取主风格
 */
function getPrimaryToneFromTraits(traits: any): PrimaryTone {
  const scores = {
    calm: traits.restPreference + traits.emotionalSensitivity / 2,
    active: traits.activity + traits.appetite / 3,
    stable: traits.discipline + traits.stability,
    sensitive:
      traits.emotionalSensitivity + (100 - traits.stability) / 2,
    balanced: 100
  }

  let best: PrimaryTone = "balanced"
  let max = scores.balanced

  for (const key in scores) {
    const tone = key as PrimaryTone
    if (scores[tone] > max) {
      max = scores[tone]
      best = tone
    }
  }

  return best
}

/**
 * 计算行为强度
 */
function getActionIntensity(
  action: string,
  traits: any
): IntensityLevel {
  let score = 50

  if (action === "eating") {
    score = traits.appetite - traits.discipline / 2
  }

  if (action === "walking") {
    score = traits.activity - traits.stability / 2
  }

  if (action === "sleeping") {
    score = traits.restPreference + traits.stability / 2
  }

  if (score < 40) return "low"
  if (score < 70) return "medium"
  return "high"
}

/**
 * 行为文案
 */
function composeActionMessage(input: PetActionEventInput): string {
  const traits = input.personalityProfile.traits
  const tone = getPrimaryToneFromTraits(traits)
  const intensity = getActionIntensity(input.action, traits)

  const { petName, action } = input

  if (action === "sleeping") {
    if (intensity === "low") {
      return `${petName}有点疲惫，慢慢躺了下来。`
    }

    if (intensity === "medium") {
      return `${petName}安静地进入了睡眠状态。`
    }

    return `${petName}几乎撑不住困意，直接沉沉睡去。`
  }

  if (action === "walking") {
    if (intensity === "low") {
      return `${petName}慢慢地在周围活动。`
    }

    if (intensity === "medium") {
      return `${petName}开始四处走动。`
    }

    return `${petName}精力充沛地四处奔走。`
  }

  if (action === "eating") {
    if (intensity === "low") {
      return `${petName}慢慢地吃了一点东西。`
    }

    if (intensity === "medium") {
      return `${petName}开始吃东西。`
    }

    return `${petName}几乎迫不及待地开始大口进食。`
  }

  return `${petName}改变了行动状态。`
}

/**
 * 心情强度
 */
function getMoodIntensity(traits: any): IntensityLevel {
  const score =
    traits.emotionalSensitivity - traits.stability / 2

  if (score < 40) return "low"
  if (score < 70) return "medium"
  return "high"
}

/**
 * 心情文案
 */
function composeMoodMessage(input: PetMoodEventInput): string {
  const traits = input.personalityProfile.traits
  const tone = getPrimaryToneFromTraits(traits)
  const intensity = getMoodIntensity(traits)

  const { petName, mood } = input

  if (mood === "happy") {
    if (intensity === "low") {
      return `${petName}看起来稍微放松了一些。`
    }

    if (intensity === "medium") {
      return `${petName}明显变得开心起来。`
    }

    return `${petName}情绪高涨，显得非常兴奋。`
  }

  if (mood === "normal") {
    if (intensity === "low") {
      return `${petName}状态趋于稳定。`
    }

    if (intensity === "medium") {
      return `${petName}恢复到了正常状态。`
    }

    return `${petName}情绪快速波动后回到了平稳。`
  }

  if (mood === "sad") {
    if (intensity === "low") {
      return `${petName}有些低落。`
    }

    if (intensity === "medium") {
      return `${petName}情绪明显下降。`
    }

    return `${petName}情绪波动剧烈，显得非常难过。`
  }

  return `${petName}的情绪发生了变化。`
}

/**
 * 主入口
 */
export function composeStyledPetEventMessage(
  input: PetEventStyleInput
): string {
  if (input.scene === "pet_action_changed") {
    return composeActionMessage(input)
  }

  if (input.scene === "pet_mood_changed") {
    return composeMoodMessage(input)
  }

  throw new Error("未知事件类型")
}