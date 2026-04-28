/**
 * 当前文件负责：创建、挂载与重置世界舞台图层。
 */

import { Container, Graphics } from "pixi.js"

import type { WorldStageLayerRefs } from "./stage-layer-types"

export function createEmptyWorldStageLayers(): WorldStageLayerRefs {
  return {
    worldLayer: null,
    backgroundLayer: null,
    landLayer: null,
    structureLayer: null,
    natureLayer: null,
    zoneLayer: null,
    stimulusLayer: null,
    entityLayer: null,
    foregroundLayer: null,
    overlay: null,
  }
}

export function createWorldStageLayers(): WorldStageLayerRefs {
  const worldLayer = new Container()
  const backgroundLayer = new Container()
  const landLayer = new Container()
  const natureLayer = new Container()
  const structureLayer = new Container()
  const zoneLayer = new Container()
  const entityLayer = new Container()
  const stimulusLayer = new Container()
  const foregroundLayer = new Container()
  const overlay = new Graphics()

  worldLayer.addChild(backgroundLayer)
  worldLayer.addChild(landLayer)
  worldLayer.addChild(natureLayer)
  worldLayer.addChild(structureLayer)
  worldLayer.addChild(zoneLayer)
  worldLayer.addChild(entityLayer)
  worldLayer.addChild(stimulusLayer)
  worldLayer.addChild(foregroundLayer)

  return {
    worldLayer,
    backgroundLayer,
    landLayer,
    natureLayer,
    structureLayer,
    zoneLayer,
    entityLayer,
    stimulusLayer,
    foregroundLayer,
    overlay,
  }
}

export function attachWorldStageLayers(input: {
  appStage: Container
  layers: WorldStageLayerRefs
}) {
  if (input.layers.worldLayer) {
    input.appStage.addChild(input.layers.worldLayer)
  }

  if (input.layers.overlay) {
    input.appStage.addChild(input.layers.overlay)
  }
}