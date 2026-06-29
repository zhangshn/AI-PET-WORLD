import type { ZiweiStarDefinition } from "../contracts"

export const YEARLY_STAR_IDS = {
  boshi: "ziwei.yearly.boshi",
  lishi: "ziwei.yearly.lishi",
  qinglong: "ziwei.yearly.qinglong",
  xiaohao: "ziwei.yearly.xiaohao",
  jiangjun: "ziwei.yearly.jiangjun",
  zoushu: "ziwei.yearly.zoushu",
  feilian: "ziwei.yearly.feilian",
  xishen: "ziwei.yearly.xishen",
  bingfu: "ziwei.yearly.bingfu",
  dahao: "ziwei.yearly.dahao",
  fubing: "ziwei.yearly.fubing",
  guanfu: "ziwei.yearly.guanfu",
  suijian: "ziwei.yearly.suijian",
  huiqi: "ziwei.yearly.huiqi",
  sangmen: "ziwei.yearly.sangmen",
  guansuo: "ziwei.yearly.guansuo",
  suiGuanfu: "ziwei.yearly.sui-guanfu",
  suiXiaohao: "ziwei.yearly.sui-xiaohao",
  suiDahao: "ziwei.yearly.sui-dahao",
  longde: "ziwei.yearly.longde",
  baihu: "ziwei.yearly.baihu",
  tiande: "ziwei.yearly.tiande",
  diaoke: "ziwei.yearly.diaoke",
  suiBingfu: "ziwei.yearly.sui-bingfu",
  jiangxing: "ziwei.yearly.jiangxing",
  panan: "ziwei.yearly.panan",
  suiyi: "ziwei.yearly.suiyi",
  xishenRest: "ziwei.yearly.xishen-rest",
  huagai: "ziwei.yearly.huagai",
  jiesha: "ziwei.yearly.jiesha",
  zaisha: "ziwei.yearly.zaisha",
  tiansha: "ziwei.yearly.tiansha",
  zhibei: "ziwei.yearly.zhibei",
  xianchi: "ziwei.yearly.xianchi",
  yuesha: "ziwei.yearly.yuesha",
  wangshen: "ziwei.yearly.wangshen"
} as const

export const yearlyStarCatalog: ZiweiStarDefinition[] = [
  {
    starId: YEARLY_STAR_IDS.boshi,
    label: "博士",
    category: "yearly",
    enabled: true,
    displayOrder: 910
  },
  {
    starId: YEARLY_STAR_IDS.lishi,
    label: "力士",
    category: "yearly",
    enabled: true,
    displayOrder: 920
  },
  {
    starId: YEARLY_STAR_IDS.qinglong,
    label: "青龙",
    category: "yearly",
    enabled: true,
    displayOrder: 930
  },
  {
    starId: YEARLY_STAR_IDS.xiaohao,
    label: "小耗",
    category: "yearly",
    enabled: true,
    displayOrder: 940
  },
  {
    starId: YEARLY_STAR_IDS.jiangjun,
    label: "将军",
    category: "yearly",
    enabled: true,
    displayOrder: 950
  },
  {
    starId: YEARLY_STAR_IDS.zoushu,
    label: "奏书",
    category: "yearly",
    enabled: true,
    displayOrder: 960
  },
  {
    starId: YEARLY_STAR_IDS.feilian,
    label: "飞廉",
    category: "yearly",
    enabled: true,
    displayOrder: 970
  },
  {
    starId: YEARLY_STAR_IDS.xishen,
    label: "喜神",
    category: "yearly",
    enabled: true,
    displayOrder: 980
  },
  {
    starId: YEARLY_STAR_IDS.bingfu,
    label: "病符",
    category: "yearly",
    enabled: true,
    displayOrder: 990
  },
  {
    starId: YEARLY_STAR_IDS.dahao,
    label: "大耗",
    category: "yearly",
    enabled: true,
    displayOrder: 1000
  },
  {
    starId: YEARLY_STAR_IDS.fubing,
    label: "伏兵",
    category: "yearly",
    enabled: true,
    displayOrder: 1010
  },
  {
    starId: YEARLY_STAR_IDS.guanfu,
    label: "官府",
    category: "yearly",
    enabled: true,
    displayOrder: 1020
  },
  {
    starId: YEARLY_STAR_IDS.suijian,
    label: "岁建",
    category: "yearly",
    enabled: true,
    displayOrder: 1110
  },
  {
    starId: YEARLY_STAR_IDS.huiqi,
    label: "晦气",
    category: "yearly",
    enabled: true,
    displayOrder: 1120
  },
  {
    starId: YEARLY_STAR_IDS.sangmen,
    label: "丧门",
    category: "yearly",
    enabled: true,
    displayOrder: 1130
  },
  {
    starId: YEARLY_STAR_IDS.guansuo,
    label: "贯索",
    category: "yearly",
    enabled: true,
    displayOrder: 1140
  },
  {
    starId: YEARLY_STAR_IDS.suiGuanfu,
    label: "官符",
    category: "yearly",
    enabled: true,
    displayOrder: 1150
  },
  {
    starId: YEARLY_STAR_IDS.suiXiaohao,
    label: "小耗",
    category: "yearly",
    enabled: true,
    displayOrder: 1160
  },
  {
    starId: YEARLY_STAR_IDS.suiDahao,
    label: "大耗",
    category: "yearly",
    enabled: true,
    displayOrder: 1170
  },
  {
    starId: YEARLY_STAR_IDS.longde,
    label: "龙德",
    category: "yearly",
    enabled: true,
    displayOrder: 1180
  },
  {
    starId: YEARLY_STAR_IDS.baihu,
    label: "白虎",
    category: "yearly",
    enabled: true,
    displayOrder: 1190
  },
  {
    starId: YEARLY_STAR_IDS.tiande,
    label: "天德",
    category: "yearly",
    enabled: true,
    displayOrder: 1200
  },
  {
    starId: YEARLY_STAR_IDS.diaoke,
    label: "吊客",
    category: "yearly",
    enabled: true,
    displayOrder: 1210
  },
  {
    starId: YEARLY_STAR_IDS.suiBingfu,
    label: "病符",
    category: "yearly",
    enabled: true,
    displayOrder: 1220
  },
  {
    starId: YEARLY_STAR_IDS.jiangxing,
    label: "将星",
    category: "yearly",
    enabled: true,
    displayOrder: 1310
  },
  {
    starId: YEARLY_STAR_IDS.panan,
    label: "攀鞍",
    category: "yearly",
    enabled: true,
    displayOrder: 1320
  },
  {
    starId: YEARLY_STAR_IDS.suiyi,
    label: "岁驿",
    category: "yearly",
    enabled: true,
    displayOrder: 1330
  },
  {
    starId: YEARLY_STAR_IDS.xishenRest,
    label: "息神",
    category: "yearly",
    enabled: true,
    displayOrder: 1340
  },
  {
    starId: YEARLY_STAR_IDS.huagai,
    label: "华盖",
    category: "yearly",
    enabled: true,
    displayOrder: 1350
  },
  {
    starId: YEARLY_STAR_IDS.jiesha,
    label: "劫煞",
    category: "yearly",
    enabled: true,
    displayOrder: 1360
  },
  {
    starId: YEARLY_STAR_IDS.zaisha,
    label: "灾煞",
    category: "yearly",
    enabled: true,
    displayOrder: 1370
  },
  {
    starId: YEARLY_STAR_IDS.tiansha,
    label: "天煞",
    category: "yearly",
    enabled: true,
    displayOrder: 1380
  },
  {
    starId: YEARLY_STAR_IDS.zhibei,
    label: "指背",
    category: "yearly",
    enabled: true,
    displayOrder: 1390
  },
  {
    starId: YEARLY_STAR_IDS.xianchi,
    label: "咸池",
    category: "yearly",
    enabled: true,
    displayOrder: 1400
  },
  {
    starId: YEARLY_STAR_IDS.yuesha,
    label: "月煞",
    category: "yearly",
    enabled: true,
    displayOrder: 1410
  },
  {
    starId: YEARLY_STAR_IDS.wangshen,
    label: "亡神",
    category: "yearly",
    enabled: true,
    displayOrder: 1420
  }
]
