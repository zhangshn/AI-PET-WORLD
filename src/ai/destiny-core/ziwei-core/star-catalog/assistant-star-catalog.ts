import type { ZiweiStarDefinition } from "../contracts"

export const ASSISTANT_STAR_IDS = {
  zuofu: "ziwei.assistant.zuofu",
  youbi: "ziwei.assistant.youbi",
  wenchang: "ziwei.assistant.wenchang",
  wenqu: "ziwei.assistant.wenqu",
  tiankui: "ziwei.assistant.tiankui",
  tianyue: "ziwei.assistant.tianyue",
  lucun: "ziwei.assistant.lucun",
  tianma: "ziwei.assistant.tianma"
} as const

export const assistantStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: ASSISTANT_STAR_IDS.zuofu,
    label: "左辅",
    category: "assistant",
    enabled: true,
    displayOrder: 210
  },
  {
    starId: ASSISTANT_STAR_IDS.youbi,
    label: "右弼",
    category: "assistant",
    enabled: true,
    displayOrder: 220
  },
  {
    starId: ASSISTANT_STAR_IDS.wenchang,
    label: "文昌",
    category: "assistant",
    enabled: true,
    displayOrder: 230
  },
  {
    starId: ASSISTANT_STAR_IDS.wenqu,
    label: "文曲",
    category: "assistant",
    enabled: true,
    displayOrder: 240
  },
  {
    starId: ASSISTANT_STAR_IDS.tiankui,
    label: "天魁",
    category: "assistant",
    enabled: true,
    displayOrder: 250
  },
  {
    starId: ASSISTANT_STAR_IDS.tianyue,
    label: "天钺",
    category: "assistant",
    enabled: true,
    displayOrder: 260
  },
  {
    starId: ASSISTANT_STAR_IDS.lucun,
    label: "禄存",
    category: "assistant",
    enabled: true,
    displayOrder: 270
  },
  {
    starId: ASSISTANT_STAR_IDS.tianma,
    label: "天马",
    category: "assistant",
    enabled: true,
    displayOrder: 280
  }
]
