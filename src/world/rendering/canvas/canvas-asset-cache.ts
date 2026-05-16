/**
 * 当前文件负责：预加载并缓存 Canvas 绘制需要的图片资源。
 */

import { WORLD_MAP_ASSETS } from "@/world/map-assets/world-map-asset-registry"

import { resolveMapPlacementAsset } from "../resolve-map-placement-asset"

export type CanvasAssetSource = ImageBitmap | HTMLImageElement

export type CanvasAssetRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CanvasAssetDescriptorLike = {
  path: string
  canvas?: {
    sourceRect?: CanvasAssetRect
  }
}

export type CanvasAssetRegistryLike = Record<string, CanvasAssetDescriptorLike>

const assetPromiseCache = new Map<string, Promise<CanvasAssetSource | null>>()
const imageElementPromiseCache = new Map<string, Promise<HTMLImageElement | null>>()

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.decoding = "async"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${path}`))
    image.src = path
  })
}

async function decodeImage(image: HTMLImageElement): Promise<void> {
  if (typeof image.decode === "function") {
    await image.decode()
  }
}

export async function getCanvasAssetSource(
  assetId: string,
  asset: CanvasAssetDescriptorLike
): Promise<CanvasAssetSource | null> {
  const cached = assetPromiseCache.get(assetId)

  if (cached) return cached

  const promise = (async () => {
    const image = await loadImage(asset.path)

    await decodeImage(image)

    if (typeof createImageBitmap === "function") {
      const sourceRect = asset.canvas?.sourceRect

      if (sourceRect) {
        return await createImageBitmap(
          image,
          sourceRect.x,
          sourceRect.y,
          sourceRect.width,
          sourceRect.height
        )
      }

      return await createImageBitmap(image)
    }

    return image
  })().catch(() => null)

  assetPromiseCache.set(assetId, promise)

  return promise
}

export async function preloadCanvasAssetSources(
  assetIds: readonly string[],
  assetRegistry: CanvasAssetRegistryLike
): Promise<Map<string, CanvasAssetSource>> {
  const uniqueIds = Array.from(new Set(assetIds))
  const entries = await Promise.all(
    uniqueIds.map(async (assetId) => {
      const asset = assetRegistry[assetId]

      if (!asset) return [assetId, null] as const

      const source = await getCanvasAssetSource(assetId, asset)

      return [assetId, source] as const
    })
  )
  const readyMap = new Map<string, CanvasAssetSource>()

  entries.forEach(([assetId, source]) => {
    if (source) readyMap.set(assetId, source)
  })

  return readyMap
}

export function clearCanvasAssetSourceCache(): void {
  assetPromiseCache.clear()
  imageElementPromiseCache.clear()
}

export async function loadCanvasAssetMap(
  assetIds: string[]
): Promise<Map<string, HTMLImageElement>> {
  const uniqueAssetIds = Array.from(new Set(assetIds))
  const entries = await Promise.all(
    uniqueAssetIds.map(async (assetId) => {
      const image = await loadImageElementForAssetId(assetId)

      return [assetId, image] as const
    })
  )
  const loaded = new Map<string, HTMLImageElement>()

  entries.forEach(([assetId, image]) => {
    if (image) loaded.set(assetId, image)
  })

  return loaded
}

function loadImageElementForAssetId(
  assetId: string
): Promise<HTMLImageElement | null> {
  const resolved = resolveMapPlacementAsset(assetId)

  if (!resolved) {
    warnMissingAsset(assetId)

    return Promise.resolve(null)
  }

  const cached = imageElementPromiseCache.get(resolved.assetId)

  if (cached) return cached

  const promise = loadImage(resolved.path)
    .then(async (image) => {
      await decodeImage(image)

      return image
    })
    .catch(() => {
      warnMissingAsset(assetId)

      return null
    })

  imageElementPromiseCache.set(resolved.assetId, promise)

  return promise
}

function warnMissingAsset(assetId: string) {
  if (
    process.env.NODE_ENV === "development" &&
    !(assetId in WORLD_MAP_ASSETS)
  ) {
    console.warn(`[GroundCanvasLayer] missing canvas asset: ${assetId}`)
  }
}
