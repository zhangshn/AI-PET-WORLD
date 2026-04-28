/**
 * 当前文件负责：清理外部世界动态图层。
 */

import type { WorldStageLayerRefs } from "./stage-layer-types"

export function clearExteriorDynamicLayers(layers: WorldStageLayerRefs) {
  layers.zoneLayer?.removeChildren()
  layers.entityLayer?.removeChildren()
  layers.stimulusLayer?.removeChildren()
}