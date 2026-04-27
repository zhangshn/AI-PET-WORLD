/**
 * ======================================================
 * AI-PET-WORLD
 * World Stimulus Gateway
 * ======================================================
 *
 * 当前文件负责：
 * 1. world-stimulus-system 统一出口
 * 2. 对外暴露刺激生成能力
 * ======================================================
 */

import { buildNextWorldStimulusState } from "./stimulus-engine"

export {
  buildNextWorldStimulusState,
}

export type {
  BuildWorldStimuliInput,
  WorldStimulus,
  WorldStimulusCategory,
  WorldStimulusIntensity,
  WorldStimulusSystemState,
  WorldStimulusType,
} from "./stimulus-types"