/**
 * 当前文件负责：定义世界舞台渲染器之间共享的基础类型。
 */

import type { Container, Graphics, Text } from "pixi.js"

export type StageVisualRegistry<TVisualState> = Map<string, TVisualState>

export type RuntimeVisualState = {
  container: Container
  graphic: Graphics
  label?: Text
}

export type StagePoint = {
  x: number
  y: number
}

export type StageSize = {
  width: number
  height: number
}