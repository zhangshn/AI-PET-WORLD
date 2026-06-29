import type { ZiweiStarDefinition } from "../contracts"

export const MISC_STAR_IDS = {
  hongluan: "ziwei.misc.hongluan",
  tianxi: "ziwei.misc.tianxi",
  xianchi: "ziwei.misc.xianchi",
  tianyao: "ziwei.misc.tianyao",
  taifu: "ziwei.misc.taifu",
  fenggao: "ziwei.misc.fenggao",
  longchi: "ziwei.misc.longchi",
  fengge: "ziwei.misc.fengge",
  tianwu: "ziwei.misc.tianwu",
  guchen: "ziwei.misc.guchen",
  guasu: "ziwei.misc.guasu",
  tianxing: "ziwei.misc.tianxing",
  posui: "ziwei.misc.posui",
  tianku: "ziwei.misc.tianku",
  tianxu: "ziwei.misc.tianxu"
} as const

export const miscStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: MISC_STAR_IDS.hongluan,
    label: "红鸾",
    category: "misc",
    enabled: true,
    displayOrder: 510
  },
  {
    starId: MISC_STAR_IDS.tianxi,
    label: "天喜",
    category: "misc",
    enabled: true,
    displayOrder: 520
  },
  {
    starId: MISC_STAR_IDS.xianchi,
    label: "咸池",
    category: "misc",
    enabled: true,
    displayOrder: 530
  },
  {
    starId: MISC_STAR_IDS.tianyao,
    label: "天姚",
    category: "misc",
    enabled: true,
    displayOrder: 540
  },
  {
    starId: MISC_STAR_IDS.taifu,
    label: "台辅",
    category: "misc",
    enabled: true,
    displayOrder: 550
  },
  {
    starId: MISC_STAR_IDS.fenggao,
    label: "封诰",
    category: "misc",
    enabled: true,
    displayOrder: 560
  },
  {
    starId: MISC_STAR_IDS.longchi,
    label: "龙池",
    category: "misc",
    enabled: true,
    displayOrder: 570
  },
  {
    starId: MISC_STAR_IDS.fengge,
    label: "凤阁",
    category: "misc",
    enabled: true,
    displayOrder: 580
  },
  {
    starId: MISC_STAR_IDS.tianwu,
    label: "天巫",
    category: "misc",
    enabled: true,
    displayOrder: 590
  },
  {
    starId: MISC_STAR_IDS.guchen,
    label: "孤辰",
    category: "misc",
    enabled: true,
    displayOrder: 600
  },
  {
    starId: MISC_STAR_IDS.guasu,
    label: "寡宿",
    category: "misc",
    enabled: true,
    displayOrder: 610
  },
  {
    starId: MISC_STAR_IDS.tianxing,
    label: "天刑",
    category: "misc",
    enabled: true,
    displayOrder: 620
  },
  {
    starId: MISC_STAR_IDS.posui,
    label: "破碎",
    category: "misc",
    enabled: true,
    displayOrder: 630
  },
  {
    starId: MISC_STAR_IDS.tianku,
    label: "天哭",
    category: "misc",
    enabled: true,
    displayOrder: 640
  },
  {
    starId: MISC_STAR_IDS.tianxu,
    label: "天虚",
    category: "misc",
    enabled: true,
    displayOrder: 650
  }
]
