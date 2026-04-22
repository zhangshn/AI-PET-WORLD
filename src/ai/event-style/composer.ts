/**
 * ======================================================
 * AI-PET-WORLD
 * Event Composer
 * ======================================================
 *
 * 当前文件负责：
 * 1. 根据事件输入生成最终展示文案
 * 2. 控制叙事风格（不说人话）
 * 3. 根据人格 traits + 行为 + 强度生成差异
 * ======================================================
 */

import type { PetEventStyleInput } from "./schema"

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n))
}

/**
 * ======================================================
 * 根据人格 traits 生成“语气偏移”
 * ======================================================
 */
function getTone(input: PetEventStyleInput) {
  const traits = input.personalityProfile.traits

  const sensitivity = traits.emotionalSensitivity ?? 50
  const activity = traits.activity ?? 50
  const stability = traits.stability ?? 50

  return {
    sensitive: sensitivity > 60,
    active: activity > 60,
    calm: stability > 60,
  }
}

/**
 * ======================================================
 * 行为文案（基础层）
 * ======================================================
 */
function buildActionBase(input: PetEventStyleInput): string {
  const { action, petName } = input
  const tone = getTone(input)

  switch (action) {
    case "walking":
      return pick([
        `${petName}在周围慢慢移动着`,
        `${petName}在附近来回走动`,
        `${petName}轻轻地在周围走着`,
      ])

    case "exploring":
      return tone.active
        ? pick([
            `${petName}把注意力放向了更远的地方`,
            `${petName}开始向外探查新的变化`,
          ])
        : `${petName}在周围留意着新的动静`

    case "observing":
      return `${petName}安静地看着周围`

    case "resting":
      return `${petName}慢慢让自己安静下来`

    case "alert_idle":
      return `${petName}停在原地，带着一点警觉`

    case "idle":
      return `${petName}暂时停留在原地`

    case "approaching":
      return `${petName}慢慢靠近某个方向`

    case "eating":
      return `${petName}开始进食`

    case "sleeping":
      return `${petName}进入了安静的休息`

    default:
      return `${petName}出现了一些变化`
  }
}

/**
 * ======================================================
 * 根据 intensity 增强文案
 * ======================================================
 */
function applyIntensity(
  base: string,
  intensity: number | undefined
): string {
  if (intensity === undefined) return base

  const i = clamp(intensity)

  if (i < 0.3) {
    return base.replace("慢慢", "轻轻").replace("开始", "似乎开始")
  }

  if (i > 0.7) {
    return base.replace("慢慢", "明显地").replace("轻轻", "更明显地")
  }

  return base
}

/**
 * ======================================================
 * 连续叙事修饰
 * ======================================================
 */
function applyContinuity(
  base: string,
  step?: number
): string {
  if (!step || step <= 1) return base

  if (step === 2) {
    return `随后，${base}`
  }

  if (step === 3) {
    return `又过了一会儿，${base}`
  }

  return `它继续这样，${base}`
}

/**
 * ======================================================
 * mood 文案
 * ======================================================
 */
function buildMood(input: PetEventStyleInput): string {
  const { petName, mood } = input

  switch (mood) {
    case "happy":
      return `${petName}看起来更放松了一些`
    case "sad":
      return `${petName}显得有些低落`
    case "curious":
      return `${petName}似乎被什么吸引了注意`
    case "alert":
      return `${petName}变得更警觉了一点`
    case "calm":
      return `${petName}逐渐恢复平静`
    default:
      return `${petName}的状态发生了一点变化`
  }
}

/**
 * ======================================================
 * 主入口
 * ======================================================
 */
export function composeStyledPetEventMessage(
  input: PetEventStyleInput
): string {
  /**
   * mood 事件
   */
  if (input.scene === "pet_mood_changed") {
    return buildMood(input)
  }

  /**
   * action 事件
   */
  let base = buildActionBase(input)

  base = applyIntensity(base, input.intensity)
  base = applyContinuity(base, input.continuityStep)

  return base
}