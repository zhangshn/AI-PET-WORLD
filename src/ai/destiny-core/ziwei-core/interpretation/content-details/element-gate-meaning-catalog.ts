import type { ElementGate } from "../../contracts"

import type {
  ZiweiContentDictionarySection,
  ZiweiElementGateContentDetail
} from "./content-detail-types"
import { buildElementGateDictionarySourceReferences } from "./content-source-reference-map"

export const ZIWEI_ELEMENT_GATE_ORDER: ElementGate[] = [
  "water_2",
  "wood_3",
  "metal_4",
  "earth_5",
  "fire_6"
]

export const ZIWEI_ELEMENT_GATE_CONTENT_DETAILS: Record<
  ElementGate,
  ZiweiElementGateContentDetail
> = {
  water_2: gate({
    gate: "water_2",
    label: "水二局",
    element: "water",
    baseNumber: 2,
    nature: "水二局以二为局数，带流动、适应、信息、资源循环和柔性变化之象。它是紫微斗数定紫微星位置和起大限年龄的重要基础参数之一。",
    symbolicMeanings: ["流动", "适应", "信息", "循环", "柔性", "暗流"],
    ziweiPlacementUsage: ["五行局参与紫微星起例，水二局用二作为局数基础，不在解释层重新推导紫微星落点。", "解释时可把水二局视为盘面底层气质之一，用来辅助理解命盘节奏偏流动、反应快或受环境牵引。"],
    daYunUsage: ["水二局对应大限起始年龄为二岁，后续十年一限仍由大限算法处理。", "解释大限时，水二局提示阶段转换较早进入节律，但不能因此单断早熟或漂泊。"],
    starInteraction: ["若命身宫、迁移宫、财帛宫又见水象、天马或四马地，流动与资源交换主题会更值得复核。", "遇土重或库地重时，要看水的流动是否被承载、阻滞或形成蓄积。"],
    cautions: ["五行局不是五行喜忌，也不是八字用神。", "水二局不能替代星曜、宫位、格局和动态盘判断。"]
  }),
  wood_3: gate({
    gate: "wood_3",
    label: "木三局",
    element: "wood",
    baseNumber: 3,
    nature: "木三局以三为局数，带生发、成长、学习、规划、关系延伸和柔性扩张之象。它是紫微星定位和大限起龄的基础局数资料。",
    symbolicMeanings: ["生发", "成长", "计划", "学习", "关系延伸", "扩张"],
    ziweiPlacementUsage: ["木三局参与紫微星起例，三为局数基础；解释层只读取结果，不重排紫微星。", "盘面分析可把木三局作为成长型、规划型、逐步展开型节奏的底层提示。"],
    daYunUsage: ["木三局对应大限起始年龄为三岁，阶段节奏比水二局略后。", "看大限时，木三局可提示发展要靠培育、学习、持续投入和关系延伸。"],
    starInteraction: ["遇文昌、文曲、化科、天梁、天同等偏学习、涵养或照护星曜时，木三局的成长语义更明显。", "遇煞忌重时，要看计划分散、枝蔓过多或成长受挫。"],
    cautions: ["木三局不等于一定文雅或读书好。", "局数只是基础节律，必须回到命宫主星、三方四正和格局证据。"]
  }),
  metal_4: gate({
    gate: "metal_4",
    label: "金四局",
    element: "metal",
    baseNumber: 4,
    nature: "金四局以四为局数，带规则、执行、收敛、技术、财务、标准和取舍判断之象。它给紫微起星和大限起龄提供基础局数。",
    symbolicMeanings: ["规则", "执行", "收敛", "技术", "标准", "取舍"],
    ziweiPlacementUsage: ["金四局参与紫微星起例，四为局数基础；解释层只说明含义，不改安星。", "盘面底色可参考金的标准、执行、切割和秩序感，但仍要由星曜组合来决定表现。"],
    daYunUsage: ["金四局对应大限起始年龄为四岁。", "解释大限时，金四局可提示阶段发展更重规则、技能、效率和现实标准。"],
    starInteraction: ["遇武曲、七杀、破军、擎羊、陀罗等刚性星曜时，金四局要复核执行力与冲突代价。", "遇文曜或化科时，金四局也可表现为技术标准、审查、证照和专业化。"],
    cautions: ["金四局不是必然冷硬，也不等于财运结论。", "规则与执行必须结合宫位主题和星曜性质判断。"]
  }),
  earth_5: gate({
    gate: "earth_5",
    label: "土五局",
    element: "earth",
    baseNumber: 5,
    nature: "土五局以五为局数，带承载、整合、平台、责任、积累和中轴稳定之象。它是紫微星起例和大限起龄的基础资料之一。",
    symbolicMeanings: ["承载", "整合", "平台", "责任", "积累", "稳定"],
    ziweiPlacementUsage: ["土五局参与紫微星起例，五为局数基础；解释层只解释局数语义。", "盘面底色可参考土的承载、守成、资源整合和平台意识。"],
    daYunUsage: ["土五局对应大限起始年龄为五岁，阶段推进常需要现实承接和稳定结构。", "解释大限时，土五局提示阶段主题容易落到责任、家庭、资源、组织或长期建设。"],
    starInteraction: ["遇辰戌丑未、田宅、财帛、福德、疾厄等承载类主题时，土五局需要复核积累和压力。", "遇火星、铃星、化忌等压力信号时，要看土是否变成沉重、迟滞或难以转圜。"],
    cautions: ["土五局不等于保守命，也不等于一定有地产。", "土的承载语义不能替代具体宫位和星曜证据。"]
  }),
  fire_6: gate({
    gate: "fire_6",
    label: "火六局",
    element: "fire",
    baseNumber: 6,
    nature: "火六局以六为局数，带表现、热度、行动、名声、外放、理想和快速推动之象。它参与紫微星起例，也决定大限起始年龄。",
    symbolicMeanings: ["表现", "热度", "行动", "名声", "外放", "推动"],
    ziweiPlacementUsage: ["火六局参与紫微星起例，六为局数基础；解释层不重算紫微落宫。", "盘面底色可参考火的外显、推动、热度和表现欲，但强弱仍取决于星曜、宫位和动态层。"],
    daYunUsage: ["火六局对应大限起始年龄为六岁。", "解释大限时，火六局可提示阶段发展需要行动、曝光、表达或目标推动。"],
    starInteraction: ["遇太阳、廉贞、贪狼、火星、铃星、化权等信号时，火六局的热度和推动感更明显。", "若同时见化忌、空劫或煞重，要复核过热、冲动、耗损和反复。"],
    cautions: ["火六局不等于必然显贵或急躁。", "火的表现力要看是否有星曜承接和宫位落点。"]
  })
}

export function getElementGateContentDetail(
  gate: ElementGate
): ZiweiElementGateContentDetail | null {
  return ZIWEI_ELEMENT_GATE_CONTENT_DETAILS[gate] ?? null
}

export function getAllElementGateContentDetails(): ZiweiElementGateContentDetail[] {
  return ZIWEI_ELEMENT_GATE_ORDER.map((gate) => ZIWEI_ELEMENT_GATE_CONTENT_DETAILS[gate])
}

function gate(
  input: Omit<ZiweiElementGateContentDetail, "sections" | "sourceReferences">
): ZiweiElementGateContentDetail {
  const sourceReferences = buildElementGateDictionarySourceReferences()

  return {
    ...input,
    sourceReferences,
    sections: buildElementGateSections({ ...input, sourceReferences })
  }
}

function buildElementGateSections(
  detail: Omit<ZiweiElementGateContentDetail, "sections">
): ZiweiContentDictionarySection[] {
  return [
    {
      title: "五行局本体",
      items: [
        `${detail.label}以${detail.baseNumber}为局数，五行属${elementLabel(detail.element)}。${detail.nature}`,
        `核心象义包括：${detail.symbolicMeanings.join("、")}。`
      ]
    },
    {
      title: "紫微起例边界",
      items: detail.ziweiPlacementUsage
    },
    {
      title: "大限节律",
      items: detail.daYunUsage
    },
    {
      title: "星曜互动",
      items: detail.starInteraction
    },
    {
      title: "误读边界",
      items: detail.cautions
    }
  ]
}

function elementLabel(element: ZiweiElementGateContentDetail["element"]): string {
  const labels: Record<ZiweiElementGateContentDetail["element"], string> = {
    wood: "木",
    fire: "火",
    earth: "土",
    metal: "金",
    water: "水"
  }

  return labels[element]
}
