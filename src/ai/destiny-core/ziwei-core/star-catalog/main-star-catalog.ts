import type { ZiweiStarDefinition } from "../contracts"

export const MAIN_STAR_IDS = {
  ziwei: "ziwei.main.ziwei",
  tanlang: "ziwei.main.tanlang",
  jumen: "ziwei.main.jumen",
  lianzhen: "ziwei.main.lianzhen",
  wuqu: "ziwei.main.wuqu",
  pojun: "ziwei.main.pojun",
  tianfu: "ziwei.main.tianfu",
  tianji: "ziwei.main.tianji",
  tianxiang: "ziwei.main.tianxiang",
  tianliang: "ziwei.main.tianliang",
  tiantong: "ziwei.main.tiantong",
  qisha: "ziwei.main.qisha",
  taiyang: "ziwei.main.taiyang",
  taiyin: "ziwei.main.taiyin"
} as const

export const mainStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: MAIN_STAR_IDS.ziwei,
    label: "紫微",
    category: "main",
    enabled: true,
    displayOrder: 10,
    legacyStarId: "star_01"
  },
  {
    starId: MAIN_STAR_IDS.tanlang,
    label: "贪狼",
    category: "main",
    enabled: true,
    displayOrder: 20,
    legacyStarId: "star_02"
  },
  {
    starId: MAIN_STAR_IDS.jumen,
    label: "巨门",
    category: "main",
    enabled: true,
    displayOrder: 30,
    legacyStarId: "star_03"
  },
  {
    starId: MAIN_STAR_IDS.lianzhen,
    label: "廉贞",
    category: "main",
    enabled: true,
    displayOrder: 40,
    legacyStarId: "star_04"
  },
  {
    starId: MAIN_STAR_IDS.wuqu,
    label: "武曲",
    category: "main",
    enabled: true,
    displayOrder: 50,
    legacyStarId: "star_05"
  },
  {
    starId: MAIN_STAR_IDS.pojun,
    label: "破军",
    category: "main",
    enabled: true,
    displayOrder: 60,
    legacyStarId: "star_06"
  },
  {
    starId: MAIN_STAR_IDS.tianfu,
    label: "天府",
    category: "main",
    enabled: true,
    displayOrder: 70,
    legacyStarId: "star_07"
  },
  {
    starId: MAIN_STAR_IDS.tianji,
    label: "天机",
    category: "main",
    enabled: true,
    displayOrder: 80,
    legacyStarId: "star_08"
  },
  {
    starId: MAIN_STAR_IDS.tianxiang,
    label: "天相",
    category: "main",
    enabled: true,
    displayOrder: 90,
    legacyStarId: "star_09"
  },
  {
    starId: MAIN_STAR_IDS.tianliang,
    label: "天梁",
    category: "main",
    enabled: true,
    displayOrder: 100,
    legacyStarId: "star_10"
  },
  {
    starId: MAIN_STAR_IDS.tiantong,
    label: "天同",
    category: "main",
    enabled: true,
    displayOrder: 110,
    legacyStarId: "star_11"
  },
  {
    starId: MAIN_STAR_IDS.qisha,
    label: "七杀",
    category: "main",
    enabled: true,
    displayOrder: 120,
    legacyStarId: "star_12"
  },
  {
    starId: MAIN_STAR_IDS.taiyang,
    label: "太阳",
    category: "main",
    enabled: true,
    displayOrder: 130,
    legacyStarId: "star_13"
  },
  {
    starId: MAIN_STAR_IDS.taiyin,
    label: "太阴",
    category: "main",
    enabled: true,
    displayOrder: 140,
    legacyStarId: "star_14"
  }
]
