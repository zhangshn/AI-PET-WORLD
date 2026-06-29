import type { ZiweiStarDefinition } from "../contracts"

export const DAILY_HOURLY_STAR_IDS = {
  santai: "ziwei.daily-hourly.santai",
  bazuo: "ziwei.daily-hourly.bazuo",
  enguang: "ziwei.daily-hourly.enguang",
  tiangui: "ziwei.daily-hourly.tiangui"
} as const

export const dailyHourlyStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: DAILY_HOURLY_STAR_IDS.santai,
    label: "三台",
    category: "dailyHourly",
    enabled: true,
    displayOrder: 1610
  },
  {
    starId: DAILY_HOURLY_STAR_IDS.bazuo,
    label: "八座",
    category: "dailyHourly",
    enabled: true,
    displayOrder: 1620
  },
  {
    starId: DAILY_HOURLY_STAR_IDS.enguang,
    label: "恩光",
    category: "dailyHourly",
    enabled: true,
    displayOrder: 1630
  },
  {
    starId: DAILY_HOURLY_STAR_IDS.tiangui,
    label: "天贵",
    category: "dailyHourly",
    enabled: true,
    displayOrder: 1640
  }
]
