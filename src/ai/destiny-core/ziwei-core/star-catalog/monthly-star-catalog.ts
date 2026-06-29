import type { ZiweiStarDefinition } from "../contracts"

export const MONTHLY_STAR_IDS = {
  yuejie: "ziwei.monthly.yuejie",
  tianwu: "ziwei.monthly.tianwu",
  tianyue: "ziwei.monthly.tianyue",
  yinsha: "ziwei.monthly.yinsha"
} as const

export const monthlyStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: MONTHLY_STAR_IDS.yuejie,
    label: "月解",
    category: "monthly",
    enabled: true,
    displayOrder: 1510
  },
  {
    starId: MONTHLY_STAR_IDS.tianwu,
    label: "天巫",
    category: "monthly",
    enabled: true,
    displayOrder: 1520
  },
  {
    starId: MONTHLY_STAR_IDS.tianyue,
    label: "天月",
    category: "monthly",
    enabled: true,
    displayOrder: 1530
  },
  {
    starId: MONTHLY_STAR_IDS.yinsha,
    label: "阴煞",
    category: "monthly",
    enabled: true,
    displayOrder: 1540
  }
]
