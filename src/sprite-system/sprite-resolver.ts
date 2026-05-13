/**
 * 当前文件负责：按视觉变体编号解析 Sprite 元数据。
 */

import type {
  SpriteFrameMetadata,
  SpriteMetadataIndex,
  SpriteVariantMapping,
} from "./sprite-metadata.types"
import { spriteMetadataIndex } from "./sprite-index"

export type ResolvedSpriteVariant = {
  mapping: SpriteVariantMapping
  frame: SpriteFrameMetadata
}

export function findSpriteVariantMapping(
  spriteVariantId: string,
  index: SpriteMetadataIndex = spriteMetadataIndex
): SpriteVariantMapping | undefined {
  return index.variantMappings.find(
    (mapping) => mapping.spriteVariantId === spriteVariantId
  )
}

export function findSpriteFrame(
  frameId: string,
  index: SpriteMetadataIndex = spriteMetadataIndex
): SpriteFrameMetadata | undefined {
  return index.sheets
    .flatMap((sheet) => sheet.frames)
    .find((frame) => frame.id === frameId)
}

export function resolveSpriteVariant(
  spriteVariantId: string,
  index: SpriteMetadataIndex = spriteMetadataIndex
): ResolvedSpriteVariant | undefined {
  const mapping = findSpriteVariantMapping(spriteVariantId, index)

  if (!mapping) return undefined

  const frame = findSpriteFrame(mapping.frameId, index)

  if (!frame) return undefined

  return {
    mapping,
    frame,
  }
}

export function resolveSpriteVariants(
  spriteVariantIds: string[],
  index: SpriteMetadataIndex = spriteMetadataIndex
): ResolvedSpriteVariant[] {
  return spriteVariantIds.flatMap((spriteVariantId) => {
    const result = resolveSpriteVariant(spriteVariantId, index)

    return result ? [result] : []
  })
}
