/**
 * 当前文件负责：渲染世界舞台的背景氛围、自然光斑与前景遮罩。
 */

import { Container, Graphics } from "pixi.js"

export function drawStageBackground(input: {
  layer: Container
  mapWidth: number
  mapHeight: number
}) {
  const background = new Graphics()

  background.rect(0, 0, input.mapWidth, input.mapHeight).fill(0x102818)
  background.circle(250, 160, 220).fill({
    color: 0x1f4d2b,
    alpha: 0.34,
  })
  background.circle(input.mapWidth - 260, 260, 260).fill({
    color: 0x163d2a,
    alpha: 0.28,
  })

  input.layer.addChild(background)
}

export function drawAmbientNature(input: {
  layer: Container
  mapWidth: number
  mapHeight: number
}) {
  const ambient = new Graphics()

  ambient.circle(430, 210, 150).fill({
    color: 0x86efac,
    alpha: 0.035,
  })
  ambient.circle(800, 380, 210).fill({
    color: 0x60a5fa,
    alpha: 0.025,
  })
  ambient.circle(input.mapWidth - 240, 160, 180).fill({
    color: 0xfacc15,
    alpha: 0.025,
  })

  for (let index = 0; index < 34; index += 1) {
    const x = (index * 97) % Math.max(input.mapWidth, 1)
    const y = (index * 53) % Math.max(input.mapHeight, 1)
    const size = 3 + (index % 3)

    ambient.rect(x, y, size, size).fill({
      color: index % 2 === 0 ? 0x86efac : 0xfacc15,
      alpha: 0.2,
    })
  }

  input.layer.addChild(ambient)
}

export function drawForegroundAtmosphere(input: {
  layer: Container
  mapWidth: number
  mapHeight: number
}) {
  const atmosphere = new Graphics()

  atmosphere.rect(0, 0, input.mapWidth, 40).fill({
    color: 0x000000,
    alpha: 0.08,
  })

  atmosphere.rect(0, input.mapHeight - 52, input.mapWidth, 52).fill({
    color: 0x000000,
    alpha: 0.12,
  })

  atmosphere.circle(360, 250, 110).fill({
    color: 0x000000,
    alpha: 0.06,
  })

  atmosphere.circle(980, 520, 120).fill({
    color: 0x000000,
    alpha: 0.07,
  })

  input.layer.addChild(atmosphere)
}