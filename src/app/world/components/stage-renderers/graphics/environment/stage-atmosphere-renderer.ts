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
  background.circle(input.mapWidth - 280, input.mapHeight - 210, 180).fill({
    color: 0x1d4f5f,
    alpha: 0.16,
  })

  input.layer.addChild(background)
}

export function drawAmbientNature(input: {
  layer: Container
  mapWidth: number
  mapHeight: number
}) {
  const ambient = new Graphics()

  drawSoftLightFields(ambient, input.mapWidth, input.mapHeight)
  drawLakeHint(ambient, input.mapWidth, input.mapHeight)
  drawButterflyAndFlowerSignals(ambient, input.mapWidth, input.mapHeight)
  drawFireflySignals(ambient, input.mapWidth)
  drawTinyGrassSparkles(ambient, input.mapWidth, input.mapHeight)

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

  atmosphere.circle(input.mapWidth - 250, input.mapHeight - 180, 150).fill({
    color: 0x93c5fd,
    alpha: 0.035,
  })

  input.layer.addChild(atmosphere)
}

function drawSoftLightFields(
  graphic: Graphics,
  mapWidth: number,
  mapHeight: number
) {
  graphic.circle(430, 210, 150).fill({
    color: 0x86efac,
    alpha: 0.035,
  })
  graphic.circle(800, 380, 210).fill({
    color: 0x60a5fa,
    alpha: 0.025,
  })
  graphic.circle(mapWidth - 240, 160, 180).fill({
    color: 0xfacc15,
    alpha: 0.025,
  })
  graphic.circle(260, mapHeight - 180, 130).fill({
    color: 0xfde68a,
    alpha: 0.018,
  })
}

function drawLakeHint(
  graphic: Graphics,
  mapWidth: number,
  mapHeight: number
) {
  const lakeX = mapWidth - 360
  const lakeY = mapHeight - 270

  graphic.ellipse(lakeX, lakeY, 145, 58).fill({
    color: 0x1d4f5f,
    alpha: 0.34,
  })

  graphic.ellipse(lakeX - 8, lakeY - 4, 122, 43).fill({
    color: 0x256d7b,
    alpha: 0.24,
  })

  for (let index = 0; index < 5; index += 1) {
    graphic.rect(lakeX - 88 + index * 38, lakeY - 13 + (index % 2) * 8, 25, 2).fill({
      color: 0x93c5fd,
      alpha: 0.2,
    })
  }

  graphic.rect(lakeX - 118, lakeY + 46, 42, 5).fill({
    color: 0x86efac,
    alpha: 0.18,
  })
  graphic.rect(lakeX + 72, lakeY + 38, 34, 4).fill({
    color: 0x86efac,
    alpha: 0.16,
  })
}

function drawButterflyAndFlowerSignals(
  graphic: Graphics,
  mapWidth: number,
  mapHeight: number
) {
  const flowerBaseX = Math.max(260, mapWidth * 0.36)
  const flowerBaseY = Math.max(230, mapHeight * 0.42)

  for (let index = 0; index < 8; index += 1) {
    const x = flowerBaseX + (index % 4) * 28
    const y = flowerBaseY + Math.floor(index / 4) * 22

    graphic.rect(x, y, 4, 4).fill({
      color: index % 2 === 0 ? 0xf472b6 : 0xfacc15,
      alpha: 0.28,
    })
    graphic.rect(x + 4, y + 3, 3, 3).fill({
      color: 0x86efac,
      alpha: 0.2,
    })
  }

  for (let index = 0; index < 4; index += 1) {
    const x = flowerBaseX + 18 + index * 34
    const y = flowerBaseY - 26 + (index % 2) * 14

    graphic.rect(x, y, 4, 3).fill({
      color: 0xfde68a,
      alpha: 0.32,
    })
    graphic.rect(x + 5, y + 1, 4, 3).fill({
      color: 0xfacc15,
      alpha: 0.24,
    })
  }

  for (let index = 0; index < 7; index += 1) {
    graphic.rect(
      flowerBaseX + 10 + index * 18,
      flowerBaseY + 58 - (index % 3) * 7,
      3,
      3
    ).fill({
      color: 0xfde68a,
      alpha: 0.13,
    })
  }
}

function drawFireflySignals(
  graphic: Graphics,
  mapWidth: number
) {
  const startX = mapWidth - 420
  const startY = 135

  for (let index = 0; index < 10; index += 1) {
    const x = startX + (index * 47) % 260
    const y = startY + (index * 31) % 170

    graphic.rect(x, y, 3, 3).fill({
      color: 0xfde68a,
      alpha: index % 2 === 0 ? 0.2 : 0.12,
    })
  }
}

function drawTinyGrassSparkles(
  graphic: Graphics,
  mapWidth: number,
  mapHeight: number
) {
  for (let index = 0; index < 34; index += 1) {
    const x = (index * 97) % Math.max(mapWidth, 1)
    const y = (index * 53) % Math.max(mapHeight, 1)
    const size = 3 + (index % 3)

    graphic.rect(x, y, size, size).fill({
      color: index % 2 === 0 ? 0x86efac : 0xfacc15,
      alpha: 0.16,
    })
  }
}