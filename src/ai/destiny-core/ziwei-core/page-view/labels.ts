import type {
  BranchPalace,
  HeavenlyStem,
  SectorName,
  ZiweiCycleDirection,
  ZiweiDynamicFlowType,
  ZiweiStarCategory
} from "../contracts"

export const BRANCH_LABELS: Record<BranchPalace, string> = {
  yin: "寅",
  mao: "卯",
  chen: "辰",
  si: "巳",
  wu: "午",
  wei: "未",
  shen: "申",
  you: "酉",
  xu: "戌",
  hai: "亥",
  zi: "子",
  chou: "丑"
}

export const STEM_LABELS: Record<HeavenlyStem, string> = {
  jia: "甲",
  yi: "乙",
  bing: "丙",
  ding: "丁",
  wu: "戊",
  ji: "己",
  geng: "庚",
  xin: "辛",
  ren: "壬",
  gui: "癸"
}

export const SECTOR_LABELS: Record<SectorName, string> = {
  life: "命宫",
  siblings: "兄弟",
  spouse: "夫妻",
  children: "子女",
  wealth: "财帛",
  health: "疾厄",
  travel: "迁移",
  friends: "交友",
  career: "官禄",
  property: "田宅",
  fortune: "福德",
  parents: "父母"
}

export const STAR_CATEGORY_LABELS: Record<ZiweiStarCategory, string> = {
  empty: "空宫",
  main: "主星",
  assistant: "辅曜",
  malefic: "煞曜",
  transformation: "四化",
  misc: "杂曜",
  lifecycle: "长生十二神",
  yearly: "年系星曜",
  monthly: "月系星曜",
  dailyHourly: "日时系星曜"
}

export const DYNAMIC_FLOW_LABELS: Record<ZiweiDynamicFlowType, string> = {
  natal: "本命",
  daYun: "大限",
  liuNian: "流年",
  liuYue: "流月",
  liuRi: "流日",
  liuShi: "流时"
}

export const DYNAMIC_DIRECTION_LABELS: Record<ZiweiCycleDirection, string> = {
  forward: "顺行",
  backward: "逆行"
}

export const STAR_CATEGORY_DISPLAY_ORDER = [
  "main",
  "assistant",
  "malefic",
  "transformation",
  "misc",
  "lifecycle",
  "yearly",
  "monthly",
  "dailyHourly"
] as const satisfies readonly Exclude<ZiweiStarCategory, "empty">[]

export type DisplayedZiweiStarCategory =
  typeof STAR_CATEGORY_DISPLAY_ORDER[number]
