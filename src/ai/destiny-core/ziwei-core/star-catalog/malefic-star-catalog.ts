import type { ZiweiStarDefinition } from "../contracts"

export const MALEFIC_STAR_IDS = {
  qingyang: "ziwei.malefic.qingyang",
  tuoluo: "ziwei.malefic.tuoluo",
  huoxing: "ziwei.malefic.huoxing",
  lingxing: "ziwei.malefic.lingxing",
  dikong: "ziwei.malefic.dikong",
  dijie: "ziwei.malefic.dijie"
} as const

export const maleficStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: MALEFIC_STAR_IDS.qingyang,
    label: "擎羊",
    category: "malefic",
    enabled: true,
    displayOrder: 310
  },
  {
    starId: MALEFIC_STAR_IDS.tuoluo,
    label: "陀罗",
    category: "malefic",
    enabled: true,
    displayOrder: 320
  },
  {
    starId: MALEFIC_STAR_IDS.huoxing,
    label: "火星",
    category: "malefic",
    enabled: true,
    displayOrder: 330
  },
  {
    starId: MALEFIC_STAR_IDS.lingxing,
    label: "铃星",
    category: "malefic",
    enabled: true,
    displayOrder: 340
  },
  {
    starId: MALEFIC_STAR_IDS.dikong,
    label: "地空",
    category: "malefic",
    enabled: true,
    displayOrder: 350
  },
  {
    starId: MALEFIC_STAR_IDS.dijie,
    label: "地劫",
    category: "malefic",
    enabled: true,
    displayOrder: 360
  }
]
