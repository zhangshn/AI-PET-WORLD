/**
 * 当前文件负责：执行地表 Canvas 多 pass 绘制。
 */

import { resolveMapPlacementAsset } from "../resolve-map-placement-asset"
import { loadCanvasAssetMap } from "./canvas-asset-cache"
import type {
  GroundCanvasCell,
  GroundCanvasLayerInput,
} from "./ground-canvas-types"
import {
  getCardinalMask,
  pointKey,
  resolvePathAutotileAssetId,
} from "./path-autotile"
import { getStableDecalOffset } from "./stable-decal-offset"

export interface DrawGroundCanvasArgs {
  canvas: HTMLCanvasElement
  input: GroundCanvasLayerInput
  isCancelled?: () => boolean
}

type LoadedCanvasAssets = Map<string, HTMLImageElement>

const SUPPORT_EDGE_ASSET_IDS = {
  top: "edgeGrassDirtTop01",
  right: "edgeGrassDirtRight01",
  bottom: "edgeGrassDirtBottom01",
  left: "edgeGrassDirtLeft01",
} as const

export async function drawGroundCanvas(
  args: DrawGroundCanvasArgs
): Promise<void> {
  const context = args.canvas.getContext("2d")

  if (!context) return

  const logicalWidth = args.input.mapSize.columns * args.input.tileSize
  const logicalHeight = args.input.mapSize.rows * args.input.tileSize
  const dpr = window.devicePixelRatio || 1

  args.canvas.width = logicalWidth * dpr
  args.canvas.height = logicalHeight * dpr
  args.canvas.style.width = `${logicalWidth}px`
  args.canvas.style.height = `${logicalHeight}px`

  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.imageSmoothingEnabled = false
  context.clearRect(0, 0, logicalWidth, logicalHeight)

  const pathSet = new Set(args.input.placements.path.map(pointKey))
  const supportSet = new Set(args.input.placements.support.map(pointKey))
  const assetMap = await loadCanvasAssetMap(
    collectCanvasAssetIds(args.input, pathSet)
  )

  if (args.isCancelled?.()) return

  drawPlacementPass(context, args.input.matrix, assetMap, "ground", args.input)
  drawPlacementPass(context, args.input.matrix, assetMap, "support", args.input)
  drawPathPass(context, args.input, assetMap, pathSet)

  if (args.input.placements.edge.length === 0) {
    drawDerivedSupportEdges(context, args.input, assetMap, supportSet)
  }

  drawPlacementPass(context, args.input.matrix, assetMap, "edge", args.input)
  drawDecalPass(context, args.input, assetMap)
}

function drawPlacementPass(
  context: CanvasRenderingContext2D,
  matrix: GroundCanvasCell[][],
  assetMap: LoadedCanvasAssets,
  key: "ground" | "support" | "edge",
  input: GroundCanvasLayerInput
) {
  matrix.flat().forEach((cell) => {
    const placement = cell[key]

    if (!placement) return

    drawTilePlacement(context, assetMap, placement.assetId, cell, input.tileSize)
  })
}

function drawPathPass(
  context: CanvasRenderingContext2D,
  input: GroundCanvasLayerInput,
  assetMap: LoadedCanvasAssets,
  pathSet: ReadonlySet<string>
) {
  input.placements.path.forEach((placement) => {
    const assetId = resolvePathAutotileAssetId(
      getCardinalMask(placement.x, placement.y, pathSet),
      placement.assetId
    )

    drawTilePlacement(
      context,
      assetMap,
      assetId,
      { tileX: placement.x, tileY: placement.y },
      input.tileSize
    )
  })
}

function drawDerivedSupportEdges(
  context: CanvasRenderingContext2D,
  input: GroundCanvasLayerInput,
  assetMap: LoadedCanvasAssets,
  supportSet: ReadonlySet<string>
) {
  input.placements.support.forEach((placement) => {
    const directions = [
      {
        assetId: SUPPORT_EDGE_ASSET_IDS.top,
        neighbor: { x: placement.x, y: placement.y - 1 },
      },
      {
        assetId: SUPPORT_EDGE_ASSET_IDS.right,
        neighbor: { x: placement.x + 1, y: placement.y },
      },
      {
        assetId: SUPPORT_EDGE_ASSET_IDS.bottom,
        neighbor: { x: placement.x, y: placement.y + 1 },
      },
      {
        assetId: SUPPORT_EDGE_ASSET_IDS.left,
        neighbor: { x: placement.x - 1, y: placement.y },
      },
    ]

    directions.forEach((direction) => {
      if (supportSet.has(pointKey(direction.neighbor))) return

      drawTilePlacement(
        context,
        assetMap,
        direction.assetId,
        { tileX: placement.x, tileY: placement.y },
        input.tileSize
      )
    })
  })
}

function drawDecalPass(
  context: CanvasRenderingContext2D,
  input: GroundCanvasLayerInput,
  assetMap: LoadedCanvasAssets
) {
  input.placements.decals.forEach((placement) => {
    const asset = resolveMapPlacementAsset(placement.assetId)
    const image = asset ? assetMap.get(asset.assetId) : undefined

    if (!asset || !image) return

    const size = Math.round(input.tileSize * placement.scale)
    const offset = getStableDecalOffset(
      placement.id || `${placement.assetId}-${placement.x}-${placement.y}`
    )
    const dx = Math.round(
      (placement.x - 1) * input.tileSize +
        input.tileSize / 2 -
        size / 2 +
        offset.dx
    )
    const dy = Math.round(
      (placement.y - 1) * input.tileSize +
        input.tileSize / 2 -
        size / 2 +
        offset.dy
    )

    drawImage(context, image, asset, dx, dy, size, size)
  })
}

function drawTilePlacement(
  context: CanvasRenderingContext2D,
  assetMap: LoadedCanvasAssets,
  assetId: string,
  cell: Pick<GroundCanvasCell, "tileX" | "tileY">,
  tileSize: number
) {
  const asset = resolveMapPlacementAsset(assetId)
  const image = asset ? assetMap.get(asset.assetId) : undefined

  if (!asset || !image) return

  drawImage(
    context,
    image,
    asset,
    Math.round((cell.tileX - 1) * tileSize),
    Math.round((cell.tileY - 1) * tileSize),
    tileSize + 1,
    tileSize + 1
  )
}

function drawImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  asset: NonNullable<ReturnType<typeof resolveMapPlacementAsset>>,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  if (asset.crop) {
    context.drawImage(
      image,
      asset.crop.sx,
      asset.crop.sy,
      asset.crop.sw,
      asset.crop.sh,
      dx,
      dy,
      dw,
      dh
    )

    return
  }

  context.drawImage(image, dx, dy, dw, dh)
}

function collectCanvasAssetIds(
  input: GroundCanvasLayerInput,
  pathSet: ReadonlySet<string>
): string[] {
  return [
    ...input.placements.ground.map((placement) => placement.assetId),
    ...input.placements.support.map((placement) => placement.assetId),
    ...input.placements.path.map((placement) =>
      resolvePathAutotileAssetId(
        getCardinalMask(placement.x, placement.y, pathSet),
        placement.assetId
      )
    ),
    ...input.placements.edge.map((placement) => placement.assetId),
    ...input.placements.decals.map((placement) => placement.assetId),
    ...Object.values(SUPPORT_EDGE_ASSET_IDS),
  ]
}
