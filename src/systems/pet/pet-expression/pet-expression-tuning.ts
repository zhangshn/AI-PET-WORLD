/**
 * 当前文件负责：集中管理宠物行为表达层的调参参数。
 */

export const PET_EXPRESSION_GLOBAL_TUNING = {
  criticalLowEnergy: 10,
  extremeHunger: 92,
}

export const PET_EXPRESSION_NEWBORN_TUNING = {
  lowEnergyRestingThreshold: 18,
  exploreObserveThreshold: 56,
  explorePerceptionThreshold: 56,
}

export const PET_EXPRESSION_ADAPTATION_TUNING = {
  lowEnergyRestingThreshold: 22,
  highHungerIdleThreshold: 82,
  fullExploreActionThreshold: 72,
  fullExploreTendencyThreshold: 68,
  walkingToObserveThreshold: 60,
}

export const PET_EXPRESSION_DEPENDENT_TUNING = {
  restoreGoalSoftensExplore: true,
}

export const PET_EXPRESSION_COGNITION_TUNING = {
  comfortToRestEnergyThreshold: 60,
}

export const PET_EXPRESSION_TUNING_NOTES = {
  global:
    "全局表达限制只处理极端能量和饥饿，不替代 drive / goal。",
  newborn:
    "刚出生阶段允许有探索和靠近意图，但可见表达优先落在观察、停顿、恢复。",
  adaptation:
    "适应期允许探索意图逐渐外显，但大多数探索先表现为小范围移动或观察。",
  dependent:
    "依附期在恢复目标下，会把探索类意图表达为安全区休整。",
  cognition:
    "认知在表达层只改变可见表达方式，不直接生成内部意图。",
}