/**
 * 当前文件负责：提供喜好画像系统的开发测试数据。
 */

import {
  mockZiweiProbabilityProfiles,
} from "../ziwei-probability/ziwei-probability-gateway"
import {
  buildPreferenceProfileFromZiweiProbability,
} from "./ziwei-preference-mapper"

export const mockPreferenceProfiles = mockZiweiProbabilityProfiles.map(
  buildPreferenceProfileFromZiweiProbability
)
