/**
 * 当前文件负责：集中管理紫微动态详情面板使用的展示标签。
 */

export const DYNAMIC_BIAS_LABELS: Record<string, string> = {
  careBias: "照护倾向",
  observeBias: "观察倾向",
  protectBias: "保护倾向",
  exploreBias: "探索倾向",
  recordBias: "记录倾向",
  routineBias: "秩序倾向",
  repairBias: "修复倾向",
  boundaryBias: "边界倾向"
}

export const POSITION_BIAS_LABELS: Record<string, string> = {
  near_incubator: "靠近孵化器",
  near_nest: "靠近巢穴",
  near_door: "靠近门口",
  near_desk: "靠近记录桌",
  patrol_room: "房间巡查"
}

export const OBSERVATION_DISTANCE_LABELS: Record<string, string> = {
  close: "近距离观察",
  medium: "中距离观察",
  distant: "远距离观察"
}

export const TONE_BIAS_LABELS: Record<string, string> = {
  gentle: "温和",
  rational: "理性",
  concise: "简洁",
  protective: "保护性",
  curious: "好奇"
}