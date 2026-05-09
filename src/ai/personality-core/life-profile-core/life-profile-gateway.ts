/**
 * 当前文件负责：提供通用生命人格档案核心统一出口。
 */

export {
  buildLifePersonalityProfile,
} from "./life-profile-builder"

export type {
  BuildLifePersonalityProfileInput,
  LifePersonalityProfileBundle,
  LifeProfileBirthInput,
  LifeProfileSubjectType,
} from "./life-profile-schema"