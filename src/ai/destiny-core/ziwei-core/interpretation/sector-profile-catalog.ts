import type { SectorName } from "../contracts"
import { SECTOR_LABELS } from "../page-view/labels"

export interface ZiweiSectorInterpretationProfile {
  sectorName: SectorName
  label: string
  focus: string
  summary: string
  tags: string[]
}

export const SECTOR_INTERPRETATION_PROFILES: Record<
  SectorName,
  ZiweiSectorInterpretationProfile
> = {
  life: {
    sectorName: "life",
    label: SECTOR_LABELS.life,
    focus: "个性主轴、决策方式、自我定位",
    summary: "命宫用于观察本人的基础气质、行动入口和整体判断主轴。",
    tags: ["自我", "主轴", "决策"]
  },
  siblings: {
    sectorName: "siblings",
    label: SECTOR_LABELS.siblings,
    focus: "手足关系、同辈互动、近身协作",
    summary: "兄弟宫用于观察同辈关系、协作支持和近身人际状态。",
    tags: ["同辈", "协作", "关系"]
  },
  spouse: {
    sectorName: "spouse",
    label: SECTOR_LABELS.spouse,
    focus: "伴侣关系、亲密互动、合作模式",
    summary: "夫妻宫用于观察伴侣关系、亲密连接和一对一合作方式。",
    tags: ["伴侣", "亲密", "合作"]
  },
  children: {
    sectorName: "children",
    label: SECTOR_LABELS.children,
    focus: "子女、创作、延伸成果",
    summary: "子女宫用于观察子女缘、作品成果和向外延伸的创造力。",
    tags: ["子女", "创作", "成果"]
  },
  wealth: {
    sectorName: "wealth",
    label: SECTOR_LABELS.wealth,
    focus: "收入、现金流、资源使用",
    summary: "财帛宫用于观察收入结构、现金流和资源配置方式。",
    tags: ["财务", "资源", "现金流"]
  },
  health: {
    sectorName: "health",
    label: SECTOR_LABELS.health,
    focus: "身体状态、隐患、承压能力",
    summary: "疾厄宫用于观察身体承压、健康隐患和修复节奏。",
    tags: ["健康", "压力", "修复"]
  },
  travel: {
    sectorName: "travel",
    label: SECTOR_LABELS.travel,
    focus: "外部环境、迁动、对外发展",
    summary: "迁移宫用于观察外部机会、环境变化和对外行动。",
    tags: ["外部", "迁动", "发展"]
  },
  friends: {
    sectorName: "friends",
    label: SECTOR_LABELS.friends,
    focus: "朋友、团队、人脉互动",
    summary: "交友宫用于观察朋友关系、团队协作和人脉资源。",
    tags: ["朋友", "团队", "人脉"]
  },
  career: {
    sectorName: "career",
    label: SECTOR_LABELS.career,
    focus: "事业、职务、公共表现",
    summary: "官禄宫用于观察事业定位、职责承担和公共表现。",
    tags: ["事业", "职责", "表现"]
  },
  property: {
    sectorName: "property",
    label: SECTOR_LABELS.property,
    focus: "资产、居住、长期承载",
    summary: "田宅宫用于观察不动产、居住环境和长期资源承载。",
    tags: ["资产", "居住", "承载"]
  },
  fortune: {
    sectorName: "fortune",
    label: SECTOR_LABELS.fortune,
    focus: "精神状态、福分、内在满足",
    summary: "福德宫用于观察精神余裕、内在满足和长期福分。",
    tags: ["精神", "福分", "满足"]
  },
  parents: {
    sectorName: "parents",
    label: SECTOR_LABELS.parents,
    focus: "父母、长辈、背景支持",
    summary: "父母宫用于观察长辈关系、背景资源和早年支持。",
    tags: ["长辈", "背景", "支持"]
  }
}

export function getZiweiSectorInterpretationProfile(
  sectorName: SectorName
): ZiweiSectorInterpretationProfile {
  return SECTOR_INTERPRETATION_PROFILES[sectorName]
}
