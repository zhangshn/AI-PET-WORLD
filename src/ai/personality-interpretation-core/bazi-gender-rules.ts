/**
 * 当前文件负责：定义八字主导模式下的男命 / 女命解释规则。
 */

import type {
  BaziGenderFunctionKey,
  BaziGenderFunctionRule,
  FiveDimensionKey,
  BaziPrimaryFiveDimensionRule,
} from "./interpretation-schema"

export const BAZI_GENDER_FUNCTION_ORDER: BaziGenderFunctionKey[] = [
  "actionRelease",
  "reactionPattern",
  "sensoryConnection",
  "routineConsistency",
  "explorationMomentum",
  "stabilityBase",
  "persistencePattern",
  "adaptivePattern",
]

export const BAZI_GENDER_FUNCTION_RULES: Record<
  BaziGenderFunctionKey,
  BaziGenderFunctionRule
> = {
  actionRelease: {
    key: "actionRelease",
    label: "行动释放",
    sourceKey: "actionIntensity",
    baseMeaning: "行动强度、主动释放、身体动力和外部响应。",
    maleFocus: "更容易表现为主动推进、外部承担、目标行动和直接释放。",
    femaleFocus: "更容易表现为情绪响应、关系行动、选择性表达和细腻释放。",
  },
  reactionPattern: {
    key: "reactionPattern",
    label: "反应模式",
    sourceKey: "reactionSpeed",
    baseMeaning: "面对刺激、变化和外界信号时的反应速度。",
    maleFocus: "更容易表现为快速判断、直接处理、承担应对和外部行动。",
    femaleFocus: "更容易表现为敏锐察觉、快速感知、关系回应和环境判断。",
  },
  sensoryConnection: {
    key: "sensoryConnection",
    label: "感知连接",
    sourceKey: "sensoryDepth",
    baseMeaning: "对环境、关系、气氛和细节的感知深度。",
    maleFocus: "更容易表现为识别风险、判断环境、保护边界和承担照看。",
    femaleFocus: "更容易表现为细腻感知、情绪共振、关系气氛和内在安全。",
  },
  routineConsistency: {
    key: "routineConsistency",
    label: "规律一致",
    sourceKey: "consistency",
    baseMeaning: "行为模式的一致性、节奏稳定度和重复执行能力。",
    maleFocus: "更容易表现为建立规则、维持秩序、承担责任和持续推进。",
    femaleFocus: "更容易表现为稳定节奏、资源安排、关系维持和细致完成。",
  },
  explorationMomentum: {
    key: "explorationMomentum",
    label: "探索动力",
    sourceKey: "explorationDrive",
    baseMeaning: "接触未知、扩大范围、尝试变化和主动探索的动力。",
    maleFocus: "更容易表现为向外开拓、主动冒险、扩大行动范围。",
    femaleFocus: "更容易表现为选择性探索、环境适应、边界判断和谨慎移动。",
  },
  stabilityBase: {
    key: "stabilityBase",
    label: "稳定底盘",
    sourceKey: "stability",
    baseMeaning: "维持稳定、恢复秩序、安全感和长期状态的能力。",
    maleFocus: "更容易表现为守边界、建立秩序、长期责任和外部稳定。",
    femaleFocus: "更容易表现为安住、恢复、安全感、舒适感和关系稳定。",
  },
  persistencePattern: {
    key: "persistencePattern",
    label: "持续模式",
    sourceKey: "persistence",
    baseMeaning: "持续推进、长期坚持和完成阶段目标的能力。",
    maleFocus: "更容易表现为持续承担、目标推进、抗压完成和外部责任。",
    femaleFocus: "更容易表现为稳定陪伴、持续照看、耐心维持和细腻完成。",
  },
  adaptivePattern: {
    key: "adaptivePattern",
    label: "适应模式",
    sourceKey: "adaptability",
    baseMeaning: "面对变化、环境切换和不确定状态时的调整能力。",
    maleFocus: "更容易表现为快速调整策略、处理变化和主动寻找出口。",
    femaleFocus: "更容易表现为感知环境变化、调整关系位置和保留安全边界。",
  },
}

export const BAZI_PRIMARY_FIVE_DIMENSION_RULES: Record<
  FiveDimensionKey,
  BaziPrimaryFiveDimensionRule
> = {
  exploration: {
    key: "exploration",
    label: "探索性",
    baseMeaning: "好奇、外出、尝试新环境、主动接触未知。",
    sourceBaziFunctions: [
      "explorationMomentum",
      "actionRelease",
      "adaptivePattern",
    ],
    baziSupportKeys: [
      "explorationDrive",
      "actionIntensity",
      "reactionSpeed",
      "adaptability",
    ],
    vectorSupportKeys: [
      "curiosity",
      "explorationDrive",
      "activity",
      "adaptability",
    ],
  },
  attachment: {
    key: "attachment",
    label: "依附性",
    baseMeaning: "亲密、陪伴、关系绑定、安全连接。",
    sourceBaziFunctions: [
      "sensoryConnection",
      "stabilityBase",
      "persistencePattern",
    ],
    baziSupportKeys: [
      "sensoryDepth",
      "stability",
      "persistence",
    ],
    vectorSupportKeys: [
      "attachment",
      "sensitivity",
      "stability",
      "restPreference",
    ],
  },
  stability: {
    key: "stability",
    label: "稳定性",
    baseMeaning: "规律、恢复、休息、安全区、情绪平稳。",
    sourceBaziFunctions: [
      "stabilityBase",
      "routineConsistency",
      "persistencePattern",
    ],
    baziSupportKeys: [
      "stability",
      "consistency",
      "persistence",
    ],
    vectorSupportKeys: [
      "stability",
      "restPreference",
      "persistence",
      "discipline",
    ],
  },
  execution: {
    key: "execution",
    label: "执行性",
    baseMeaning: "目标、边界、推进、完成任务、掌控感。",
    sourceBaziFunctions: [
      "actionRelease",
      "routineConsistency",
      "persistencePattern",
    ],
    baziSupportKeys: [
      "actionIntensity",
      "consistency",
      "persistence",
      "reactionSpeed",
    ],
    vectorSupportKeys: [
      "discipline",
      "control",
      "persistence",
      "reactionSpeed",
    ],
  },
  caregiving: {
    key: "caregiving",
    label: "照护性",
    baseMeaning: "保护、照看、创造、延续、关心弱小对象。",
    sourceBaziFunctions: [
      "sensoryConnection",
      "stabilityBase",
      "persistencePattern",
    ],
    baziSupportKeys: [
      "sensoryDepth",
      "stability",
      "persistence",
    ],
    vectorSupportKeys: [
      "attachment",
      "sensitivity",
      "sensoryDepth",
      "stability",
    ],
  },
}