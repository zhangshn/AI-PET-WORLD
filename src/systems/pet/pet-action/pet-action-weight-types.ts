/**
 * 当前文件负责：定义宠物行为权重系统类型。
 */

import type { PetAction } from "../../../types/pet"

export type PetActionWeights = Record<PetAction, number>