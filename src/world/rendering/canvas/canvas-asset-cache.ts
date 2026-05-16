/**
 * 当前文件负责：预加载并缓存 Canvas 绘制所需图片。
 */

import { resolveMapPlacementAsset } from "../resolve-map-placement-asset"

const canvasAssetCache = new Map<string, Promise<HTMLImageElement | null>>()

export async function loadCanvasAssetMap(
  assetIds: string[]
): Promise<Map<string, HTMLImageElement>> {
  const uniqueAssetIds = Array.from(new Set(assetIds))
  const entries = await Promise.all(
    uniqueAssetIds.map(async (assetId) => {
      const image = await loadCanvasAsset(assetId)

      return [assetId, image] as const
    })
  )
  const loaded = new Map<string, HTMLImageElement>()

  entries.forEach(([assetId, image]) => {
    if (image) loaded.set(assetId, image)
  })

  return loaded
}

function loadCanvasAsset(assetId: string): Promise<HTMLImageElement | null> {
  const resolved = resolveMapPlacementAsset(assetId)

  if (!resolved) {
    warnMissingAsset(assetId)

    return Promise.resolve(null)
  }

  const cacheKey = `${resolved.assetId}|${resolved.path}`
  const cached = canvasAssetCache.get(cacheKey)

  if (cached) return cached

  const promise = createImage(resolved.path).catch(() => {
    warnMissingAsset(assetId)

    return null
  })

  canvasAssetCache.set(cacheKey, promise)

  return promise
}

async function createImage(path: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = path

  if (image.decode) {
    try {
      await image.decode()

      return image
    } catch {
      return waitForImageLoad(image)
    }
  }

  return waitForImageLoad(image)
}

function waitForImageLoad(image: HTMLImageElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${image.src}`))
  })
}

function warnMissingAsset(assetId: string) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[GroundCanvasLayer] missing canvas asset: ${assetId}`)
  }
}
