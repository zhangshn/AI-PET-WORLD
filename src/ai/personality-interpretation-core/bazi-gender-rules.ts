/**
 * 当前文件负责：定义八字主导模式下，男女先进入映射后的性格规则。
 */

import type {
  BaziDynamicsSupportKey,
  BaziGenderFunctionKey,
  BaziGenderFunctionRule,
  FiveDimensionKey,
  BaziPrimaryFiveDimensionRule,
} from "./interpretation-schema"

export type BaziSupportWeights = Partial<
  Record<BaziDynamicsSupportKey, number>
>

export type GenderAwareBaziFunctionRule = BaziGenderFunctionRule & {
  maleSupportWeights: BaziSupportWeights
  femaleSupportWeights: BaziSupportWeights
}

export type GenderAwareBaziDimensionRule = BaziPrimaryFiveDimensionRule & {
  maleFunctionWeights: Partial<Record<BaziGenderFunctionKey, number>>
  femaleFunctionWeights: Partial<Record<BaziGenderFunctionKey, number>>
}

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
  GenderAwareBaziFunctionRule
> = {
  actionRelease: {
    key: "actionRelease",
    label: "行动释放",
    sourceKey: "actionIntensity",
    baseMeaning: "行动强度、主动释放、身体动力和外部响应。",
    maleFocus: "更容易表现为主动推进、外部承担、目标行动和直接释放。",
    femaleFocus: "更容易表现为情绪响应、关系行动、选择性表达和细腻释放。",
    maleSupportWeights: {
      actionIntensity: 0.42,
      reactionSpeed: 0.22,
      persistence: 0.16,
      consistency: 0.12,
      explorationDrive: 0.08,
    },
    femaleSupportWeights: {
      sensoryDepth: 0.28,
      adaptability: 0.22,
      actionIntensity: 0.18,
      reactionSpeed: 0.16,
      stability: 0.16,
    },
  },
  reactionPattern: {
    key: "reactionPattern",
    label: "反应模式",
    sourceKey: "reactionSpeed",
    baseMeaning: "面对刺激、变化和外界信号时的反应速度。",
    maleFocus: "更容易表现为快速判断、直接处理、承担应对和外部行动。",
    femaleFocus: "更容易表现为敏锐察觉、快速感知、关系回应和环境判断。",
    maleSupportWeights: {
      reactionSpeed: 0.36,
      actionIntensity: 0.24,
      consistency: 0.16,
      adaptability: 0.14,
      persistence: 0.1,
    },
    femaleSupportWeights: {
      sensoryDepth: 0.32,
      reactionSpeed: 0.24,
      adaptability: 0.2,
      stability: 0.14,
      explorationDrive: 0.1,
    },
  },
  sensoryConnection: {
    key: "sensoryConnection",
    label: "感知连接",
    sourceKey: "sensoryDepth",
    baseMeaning: "对环境、关系、气氛和细节的感知深度。",
    maleFocus: "更容易表现为识别风险、判断环境、保护边界和承担照看。",
    femaleFocus: "更容易表现为细腻感知、情绪共振、关系气氛和内在安全。",
    maleSupportWeights: {
      sensoryDepth: 0.28,
      stability: 0.22,
      consistency: 0.18,
      persistence: 0.16,
      reactionSpeed: 0.16,
    },
    femaleSupportWeights: {
      sensoryDepth: 0.42,
      stability: 0.22,
      adaptability: 0.14,
      persistence: 0.12,
      reactionSpeed: 0.1,
    },
  },
  routineConsistency: {
    key: "routineConsistency",
    label: "规律一致",
    sourceKey: "consistency",
    baseMeaning: "行为模式的一致性、节奏稳定度和重复执行能力。",
    maleFocus: "更容易表现为建立规则、维持秩序、承担责任和持续推进。",
    femaleFocus: "更容易表现为稳定节奏、资源安排、关系维持和细致完成。",
    maleSupportWeights: {
      consistency: 0.34,
      persistence: 0.26,
      actionIntensity: 0.16,
      stability: 0.14,
      reactionSpeed: 0.1,
    },
    femaleSupportWeights: {
      consistency: 0.28,
      stability: 0.26,
      persistence: 0.22,
      sensoryDepth: 0.14,
      adaptability: 0.1,
    },
  },
  explorationMomentum: {
    key: "explorationMomentum",
    label: "探索动力",
    sourceKey: "explorationDrive",
    baseMeaning: "接触未知、扩大范围、尝试变化和主动探索的动力。",
    maleFocus: "更容易表现为向外开拓、主动冒险、扩大行动范围。",
    femaleFocus: "更容易表现为选择性探索、环境适应、边界判断和谨慎移动。",
    maleSupportWeights: {
      explorationDrive: 0.38,
      actionIntensity: 0.28,
      reactionSpeed: 0.16,
      adaptability: 0.12,
      stability: 0.06,
    },
    femaleSupportWeights: {
      adaptability: 0.3,
      sensoryDepth: 0.24,
      explorationDrive: 0.22,
      stability: 0.14,
      reactionSpeed: 0.1,
    },
  },
  stabilityBase: {
    key: "stabilityBase",
    label: "稳定底盘",
    sourceKey: "stability",
    baseMeaning: "维持稳定、恢复秩序、安全感和长期状态的能力。",
    maleFocus: "更容易表现为守边界、建立秩序、长期责任和外部稳定。",
    femaleFocus: "更容易表现为安住、恢复、安全感、舒适感和关系稳定。",
    maleSupportWeights: {
      stability: 0.3,
      consistency: 0.24,
      persistence: 0.2,
      sensoryDepth: 0.14,
      actionIntensity: 0.12,
    },
    femaleSupportWeights: {
      stability: 0.38,
      sensoryDepth: 0.24,
      consistency: 0.16,
      persistence: 0.14,
      adaptability: 0.08,
    },
  },
  persistencePattern: {
    key: "persistencePattern",
    label: "持续模式",
    sourceKey: "persistence",
    baseMeaning: "持续推进、长期坚持和完成阶段目标的能力。",
    maleFocus: "更容易表现为持续承担、目标推进、抗压完成和外部责任。",
    femaleFocus: "更容易表现为稳定陪伴、持续照看、耐心维持和细腻完成。",
    maleSupportWeights: {
      persistence: 0.34,
      consistency: 0.24,
      actionIntensity: 0.18,
      stability: 0.14,
      reactionSpeed: 0.1,
    },
    femaleSupportWeights: {
      persistence: 0.3,
      stability: 0.24,
      sensoryDepth: 0.18,
      consistency: 0.18,
      adaptability: 0.1,
    },
  },
  adaptivePattern: {
    key: "adaptivePattern",
    label: "适应模式",
    sourceKey: "adaptability",
    baseMeaning: "面对变化、环境切换和不确定状态时的调整能力。",
    maleFocus: "更容易表现为快速调整策略、处理变化和主动寻找出口。",
    femaleFocus: "更容易表现为感知环境变化、调整关系位置和保留安全边界。",
    maleSupportWeights: {
      adaptability: 0.3,
      reactionSpeed: 0.22,
      actionIntensity: 0.2,
      explorationDrive: 0.16,
      consistency: 0.12,
    },
    femaleSupportWeights: {
      adaptability: 0.34,
      sensoryDepth: 0.24,
      stability: 0.16,
      reactionSpeed: 0.14,
      explorationDrive: 0.12,
    },
  },
}

export const BAZI_PRIMARY_FIVE_DIMENSION_RULES: Record<
  FiveDimensionKey,
  GenderAwareBaziDimensionRule
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
    maleFunctionWeights: {
      explorationMomentum: 0.42,
      actionRelease: 0.32,
      adaptivePattern: 0.16,
      reactionPattern: 0.1,
    },
    femaleFunctionWeights: {
      adaptivePattern: 0.34,
      sensoryConnection: 0.24,
      explorationMomentum: 0.24,
      reactionPattern: 0.18,
    },
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
    maleFunctionWeights: {
      stabilityBase: 0.32,
      persistencePattern: 0.28,
      sensoryConnection: 0.22,
      routineConsistency: 0.18,
    },
    femaleFunctionWeights: {
      sensoryConnection: 0.36,
      stabilityBase: 0.28,
      persistencePattern: 0.2,
      adaptivePattern: 0.16,
    },
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
    maleFunctionWeights: {
      routineConsistency: 0.32,
      stabilityBase: 0.3,
      persistencePattern: 0.24,
      sensoryConnection: 0.14,
    },
    femaleFunctionWeights: {
      stabilityBase: 0.38,
      sensoryConnection: 0.24,
      routineConsistency: 0.22,
      persistencePattern: 0.16,
    },
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
    maleFunctionWeights: {
      actionRelease: 0.34,
      routineConsistency: 0.28,
      persistencePattern: 0.24,
      reactionPattern: 0.14,
    },
    femaleFunctionWeights: {
      routineConsistency: 0.3,
      persistencePattern: 0.24,
      sensoryConnection: 0.2,
      adaptivePattern: 0.14,
      actionRelease: 0.12,
    },
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
    maleFunctionWeights: {
      persistencePattern: 0.3,
      stabilityBase: 0.28,
      sensoryConnection: 0.24,
      routineConsistency: 0.18,
    },
    femaleFunctionWeights: {
      sensoryConnection: 0.38,
      stabilityBase: 0.26,
      persistencePattern: 0.2,
      adaptivePattern: 0.16,
    },
  },
}