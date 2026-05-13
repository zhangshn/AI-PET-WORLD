/**
 * 当前文件负责：导出喜好画像系统入口。
 */

export {
  buildPreferenceProfileFromZiweiProbability,
} from "./ziwei-preference-mapper"

export {
  mockPreferenceProfiles,
} from "./preference.mock"

export type {
  AtmospherePreference,
  ButlerImagePreference,
  ColorPreference,
  HomePreference,
  InteractionPreference,
  PetPreference,
  PreferenceProfile,
} from "./preference.types"
