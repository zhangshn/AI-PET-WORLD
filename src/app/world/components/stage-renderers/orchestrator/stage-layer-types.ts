/**
 * 当前文件负责：定义世界舞台渲染调度层共享的图层引用类型。
 */

import type { Container, Graphics } from "pixi.js"

export type WorldStageLayerRefs = {
  worldLayer: Container | null
  backgroundLayer: Container | null
  landLayer: Container | null
  structureLayer: Container | null
  natureLayer: Container | null
  zoneLayer: Container | null
  stimulusLayer: Container | null
  entityLayer: Container | null
  foregroundLayer: Container | null
  overlay: Graphics | null
}