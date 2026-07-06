import type {
  BranchPalace,
  ZiweiPlacedStar,
  ZiweiStarBrightness,
  ZiweiStarBrightnessLevel,
  ZiweiStarId
} from "../contracts"

import { ASSISTANT_STAR_IDS } from "./assistant-star-catalog"
import { MAIN_STAR_IDS } from "./main-star-catalog"
import { MALEFIC_STAR_IDS } from "./malefic-star-catalog"

export const ZIWEI_STAR_BRIGHTNESS_LABELS: Record<
  ZiweiStarBrightnessLevel,
  string
> = {
  miao: "庙",
  wang: "旺",
  de: "得",
  li: "利",
  ping: "平",
  bu: "不",
  xian: "陷",
  unmapped: "不论"
}

type BrightnessByBranch = Record<BranchPalace, ZiweiStarBrightnessLevel>

export const MAIN_STAR_BRIGHTNESS_TABLE: Record<string, BrightnessByBranch> = {
  [MAIN_STAR_IDS.ziwei]: {
    yin: "wang",
    mao: "miao",
    chen: "de",
    si: "wang",
    wu: "miao",
    wei: "miao",
    shen: "wang",
    you: "miao",
    xu: "de",
    hai: "wang",
    zi: "ping",
    chou: "miao"
  },
  [MAIN_STAR_IDS.tianji]: {
    yin: "miao",
    mao: "wang",
    chen: "li",
    si: "ping",
    wu: "miao",
    wei: "xian",
    shen: "miao",
    you: "wang",
    xu: "li",
    hai: "ping",
    zi: "miao",
    chou: "xian"
  },
  [MAIN_STAR_IDS.taiyang]: {
    yin: "wang",
    mao: "miao",
    chen: "wang",
    si: "wang",
    wu: "miao",
    wei: "de",
    shen: "ping",
    you: "xian",
    xu: "xian",
    hai: "xian",
    zi: "xian",
    chou: "de"
  },
  [MAIN_STAR_IDS.wuqu]: {
    yin: "li",
    mao: "ping",
    chen: "miao",
    si: "wang",
    wu: "miao",
    wei: "miao",
    shen: "li",
    you: "wang",
    xu: "miao",
    hai: "ping",
    zi: "miao",
    chou: "miao"
  },
  [MAIN_STAR_IDS.tiantong]: {
    yin: "li",
    mao: "miao",
    chen: "ping",
    si: "xian",
    wu: "xian",
    wei: "ping",
    shen: "wang",
    you: "miao",
    xu: "ping",
    hai: "miao",
    zi: "wang",
    chou: "ping"
  },
  [MAIN_STAR_IDS.lianzhen]: {
    yin: "miao",
    mao: "ping",
    chen: "li",
    si: "xian",
    wu: "miao",
    wei: "li",
    shen: "miao",
    you: "ping",
    xu: "li",
    hai: "xian",
    zi: "miao",
    chou: "li"
  },
  [MAIN_STAR_IDS.tianfu]: {
    yin: "miao",
    mao: "de",
    chen: "miao",
    si: "de",
    wu: "wang",
    wei: "miao",
    shen: "de",
    you: "miao",
    xu: "de",
    hai: "miao",
    zi: "miao",
    chou: "miao"
  },
  [MAIN_STAR_IDS.taiyin]: {
    yin: "ping",
    mao: "xian",
    chen: "xian",
    si: "xian",
    wu: "xian",
    wei: "de",
    shen: "li",
    you: "wang",
    xu: "miao",
    hai: "wang",
    zi: "miao",
    chou: "wang"
  },
  [MAIN_STAR_IDS.tanlang]: {
    yin: "ping",
    mao: "li",
    chen: "miao",
    si: "xian",
    wu: "wang",
    wei: "miao",
    shen: "ping",
    you: "li",
    xu: "miao",
    hai: "xian",
    zi: "wang",
    chou: "miao"
  },
  [MAIN_STAR_IDS.jumen]: {
    yin: "miao",
    mao: "wang",
    chen: "xian",
    si: "ping",
    wu: "wang",
    wei: "xian",
    shen: "miao",
    you: "wang",
    xu: "xian",
    hai: "ping",
    zi: "wang",
    chou: "xian"
  },
  [MAIN_STAR_IDS.tianxiang]: {
    yin: "miao",
    mao: "xian",
    chen: "de",
    si: "miao",
    wu: "de",
    wei: "miao",
    shen: "miao",
    you: "xian",
    xu: "de",
    hai: "miao",
    zi: "de",
    chou: "miao"
  },
  [MAIN_STAR_IDS.tianliang]: {
    yin: "miao",
    mao: "miao",
    chen: "wang",
    si: "xian",
    wu: "miao",
    wei: "wang",
    shen: "miao",
    you: "miao",
    xu: "wang",
    hai: "xian",
    zi: "miao",
    chou: "wang"
  },
  [MAIN_STAR_IDS.qisha]: {
    yin: "miao",
    mao: "wang",
    chen: "miao",
    si: "ping",
    wu: "wang",
    wei: "miao",
    shen: "miao",
    you: "wang",
    xu: "miao",
    hai: "ping",
    zi: "wang",
    chou: "miao"
  },
  [MAIN_STAR_IDS.pojun]: {
    yin: "de",
    mao: "xian",
    chen: "wang",
    si: "ping",
    wu: "miao",
    wei: "wang",
    shen: "de",
    you: "xian",
    xu: "wang",
    hai: "ping",
    zi: "miao",
    chou: "wang"
  }
}

export const ASSISTANT_STAR_BRIGHTNESS_TABLE: Record<string, BrightnessByBranch> = {
  [ASSISTANT_STAR_IDS.wenchang]: {
    yin: "xian",
    mao: "li",
    chen: "de",
    si: "miao",
    wu: "xian",
    wei: "li",
    shen: "de",
    you: "miao",
    xu: "xian",
    hai: "li",
    zi: "de",
    chou: "miao"
  },
  [ASSISTANT_STAR_IDS.wenqu]: {
    yin: "ping",
    mao: "wang",
    chen: "de",
    si: "miao",
    wu: "xian",
    wei: "wang",
    shen: "de",
    you: "miao",
    xu: "xian",
    hai: "wang",
    zi: "de",
    chou: "miao"
  }
}

export const MALEFIC_STAR_BRIGHTNESS_TABLE: Record<string, BrightnessByBranch> = {
  [MALEFIC_STAR_IDS.huoxing]: {
    yin: "miao",
    mao: "li",
    chen: "xian",
    si: "de",
    wu: "miao",
    wei: "li",
    shen: "xian",
    you: "de",
    xu: "miao",
    hai: "li",
    zi: "xian",
    chou: "de"
  },
  [MALEFIC_STAR_IDS.lingxing]: {
    yin: "miao",
    mao: "li",
    chen: "xian",
    si: "de",
    wu: "miao",
    wei: "li",
    shen: "xian",
    you: "de",
    xu: "miao",
    hai: "li",
    zi: "xian",
    chou: "de"
  },
  [MALEFIC_STAR_IDS.qingyang]: {
    yin: "bu",
    mao: "xian",
    chen: "miao",
    si: "bu",
    wu: "xian",
    wei: "miao",
    shen: "bu",
    you: "xian",
    xu: "miao",
    hai: "bu",
    zi: "xian",
    chou: "miao"
  },
  [MALEFIC_STAR_IDS.tuoluo]: {
    yin: "xian",
    mao: "bu",
    chen: "miao",
    si: "xian",
    wu: "bu",
    wei: "miao",
    shen: "xian",
    you: "bu",
    xu: "miao",
    hai: "xian",
    zi: "bu",
    chou: "miao"
  }
}

export const ZIWEI_STAR_BRIGHTNESS_TABLE: Record<string, BrightnessByBranch> = {
  ...MAIN_STAR_BRIGHTNESS_TABLE,
  ...ASSISTANT_STAR_BRIGHTNESS_TABLE,
  ...MALEFIC_STAR_BRIGHTNESS_TABLE
}

export function resolveZiweiStarBrightness(params: {
  starId: ZiweiStarId
  branch: BranchPalace
}): ZiweiStarBrightness {
  const directLevel = ZIWEI_STAR_BRIGHTNESS_TABLE[params.starId]?.[params.branch]
  const level = directLevel ?? "unmapped"

  return {
    level,
    label: ZIWEI_STAR_BRIGHTNESS_LABELS[level],
    sourceRuleId: resolveBrightnessSourceRuleId({
      directLevel,
      starId: params.starId
    })
  }
}

export function applyZiweiStarBrightness(
  star: ZiweiPlacedStar
): ZiweiPlacedStar {
  if (star.category === "transformation") {
    return {
      ...star,
      brightness: undefined
    }
  }

  return {
    ...star,
    brightness: resolveZiweiStarBrightness({
      starId: star.starId,
      branch: star.branch
    })
  }
}

function resolveBrightnessSourceRuleId(params: {
  directLevel?: ZiweiStarBrightnessLevel
  starId: ZiweiStarId
}): string {
  if (params.directLevel) {
    if (MAIN_STAR_BRIGHTNESS_TABLE[params.starId]) {
      return "brightness.main-stars.by-branch"
    }

    if (ASSISTANT_STAR_BRIGHTNESS_TABLE[params.starId]) {
      return "brightness.assistant-stars.by-branch"
    }

    if (MALEFIC_STAR_BRIGHTNESS_TABLE[params.starId]) {
      return "brightness.malefic-stars.by-branch"
    }
  }

  return "brightness.no-fixed-table"
}
