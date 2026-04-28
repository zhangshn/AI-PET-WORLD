/**
 * 当前文件负责：提供舞台角色绘制的通用图形工具。
 */

import { Graphics } from "pixi.js"

import { STAGE_VISUAL_CONFIG } from "../../config/stage-visual-config"

export function drawActorShadow(
  graphic: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha: number
) {
  graphic.ellipse(x, y, width, height).fill({
    color: STAGE_VISUAL_CONFIG.shadowColor,
    alpha,
  })
}