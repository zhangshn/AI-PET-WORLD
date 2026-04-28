/**
 * 当前文件负责：渲染住所室内前景遮罩与氛围层。
 */

import { Container, Graphics } from "pixi.js"

export function drawInteriorForeground(
  layer: Container,
  width: number,
  height: number
) {
  const graphic = new Graphics()

  graphic.rect(0, 0, width, 38).fill({
    color: 0x020617,
    alpha: 0.22,
  })

  graphic.rect(0, height - 44, width, 44).fill({
    color: 0x020617,
    alpha: 0.18,
  })

  layer.addChild(graphic)
}