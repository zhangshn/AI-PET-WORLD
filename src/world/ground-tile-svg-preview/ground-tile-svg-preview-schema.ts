import type { WorldViewTileKind } from "@/world/world-view-model/world-view-model-schema"

export type GroundTilePreviewRenderItem = {
  id: string
  layerKind: "tile"
  x: number
  y: number
  width: number
  height: number
  kind: WorldViewTileKind
  variant: number
  passable: boolean
  traceIntensity: number
  drawOrder: number
  tags: string[]
}
