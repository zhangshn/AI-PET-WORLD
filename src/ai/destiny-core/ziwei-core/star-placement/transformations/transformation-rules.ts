import type { HeavenlyStem, ZiweiStarId } from "../../contracts"
import {
  ASSISTANT_STAR_IDS,
  MAIN_STAR_IDS,
  TRANSFORMATION_STAR_IDS
} from "../../star-catalog"

export type TransformationKind =
  | typeof TRANSFORMATION_STAR_IDS.hualu
  | typeof TRANSFORMATION_STAR_IDS.huaquan
  | typeof TRANSFORMATION_STAR_IDS.huake
  | typeof TRANSFORMATION_STAR_IDS.huaji

export interface TransformationRule {
  transformationStarId: TransformationKind
  targetStarId: ZiweiStarId
}

export const NATAL_TRANSFORMATION_RULES_BY_YEAR_STEM: Record<
  HeavenlyStem,
  TransformationRule[]
> = {
  jia: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.lianzhen },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.pojun },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: MAIN_STAR_IDS.wuqu },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: MAIN_STAR_IDS.taiyang }
  ],
  yi: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.tianji },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.tianliang },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: MAIN_STAR_IDS.ziwei },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: MAIN_STAR_IDS.taiyin }
  ],
  bing: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.tiantong },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.tianji },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: ASSISTANT_STAR_IDS.wenchang },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: MAIN_STAR_IDS.lianzhen }
  ],
  ding: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.taiyin },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.tiantong },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: MAIN_STAR_IDS.tianji },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: MAIN_STAR_IDS.jumen }
  ],
  wu: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.tanlang },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.taiyin },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: ASSISTANT_STAR_IDS.youbi },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: MAIN_STAR_IDS.tianji }
  ],
  ji: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.wuqu },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.tanlang },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: MAIN_STAR_IDS.tianliang },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: ASSISTANT_STAR_IDS.wenqu }
  ],
  geng: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.taiyang },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.wuqu },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: MAIN_STAR_IDS.tianfu },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: MAIN_STAR_IDS.tiantong }
  ],
  xin: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.jumen },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.taiyang },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: ASSISTANT_STAR_IDS.wenqu },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: ASSISTANT_STAR_IDS.wenchang }
  ],
  ren: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.tianliang },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.ziwei },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: ASSISTANT_STAR_IDS.zuofu },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: MAIN_STAR_IDS.wuqu }
  ],
  gui: [
    { transformationStarId: TRANSFORMATION_STAR_IDS.hualu, targetStarId: MAIN_STAR_IDS.pojun },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaquan, targetStarId: MAIN_STAR_IDS.jumen },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huake, targetStarId: MAIN_STAR_IDS.taiyin },
    { transformationStarId: TRANSFORMATION_STAR_IDS.huaji, targetStarId: MAIN_STAR_IDS.tanlang }
  ]
}
