/**
 * 当前文件负责定义正式世界体验模型。
 */

export type WorldExperienceModel = {
  hero: {
    title: string
    subtitle: string
    currentNarrative: string
    statusLabel: string
  }
  pet: {
    stateLabel: string
    restNeed: number
    foodNeed: number
    waterNeed: number
    safetyNeed: number
    currentFocus: string
  }
  butler: {
    taskLabel: string
    reason: string
    nextAction: string
    autonomyLabel: string
  }
  homeGrowth: {
    zones: Array<{
      id: string
      label: string
      status: "pending" | "active" | "completed" | "observing"
      description: string
    }>
  }
  construction: {
    currentStageLabel: string
    progressPercent: number
    stages: Array<{
      id: string
      label: string
      status: "done" | "active" | "pending"
      story: string
    }>
  }
  events: Array<{
    id: string
    text: string
    tone: "quiet" | "building" | "care" | "complete"
  }>
}
