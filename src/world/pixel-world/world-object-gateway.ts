/**
 * 当前文件负责：导出像素世界对象层的查询入口。
 */

import {
  PIXEL_WORLD_OBJECTS,
} from "./world-object-registry"

import type {
  PixelWorldObjectDefinition,
  WorldObjectCategory,
  WorldObjectKind,
  WorldObjectStyleTag,
} from "./world-object-schema"

export {
  PIXEL_WORLD_OBJECTS,
}

export function getPixelWorldObjectByKind(
  kind: WorldObjectKind
): PixelWorldObjectDefinition | null {
  return PIXEL_WORLD_OBJECTS.find((object) => object.kind === kind) ?? null
}

export function getPixelWorldObjectsByCategory(
  category: WorldObjectCategory
): PixelWorldObjectDefinition[] {
  return PIXEL_WORLD_OBJECTS.filter(
    (object) => object.category === category
  )
}

export function getPixelWorldObjectsByStyleTag(
  styleTag: WorldObjectStyleTag
): PixelWorldObjectDefinition[] {
  return PIXEL_WORLD_OBJECTS.filter((object) =>
    object.styleTags.includes(styleTag)
  )
}

export function getClickablePixelWorldObjects(): PixelWorldObjectDefinition[] {
  return PIXEL_WORLD_OBJECTS.filter((object) =>
    object.interactionRoles.includes("clickable")
  )
}

export function getBuildTargetPixelWorldObjects(): PixelWorldObjectDefinition[] {
  return PIXEL_WORLD_OBJECTS.filter(
    (object) =>
      object.buildRole !== "none" ||
      object.interactionRoles.includes("build_target")
  )
}

export function getPerceivablePixelWorldObjects(): PixelWorldObjectDefinition[] {
  return PIXEL_WORLD_OBJECTS.filter(
    (object) => object.perceptionRole !== "none"
  )
}

export type {
  PixelWorldObjectDefinition,
  WorldObjectBuildRole,
  WorldObjectCategory,
  WorldObjectInteractionRole,
  WorldObjectKind,
  WorldObjectPerceptionRole,
  WorldObjectStyleTag,
} from "./world-object-schema"
