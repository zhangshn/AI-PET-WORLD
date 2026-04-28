/**
 * 当前文件负责：创建并挂载宠物与管家的舞台显示对象。
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js"

import type { CreateCoreActorsInput } from "./actor-types"

export function createCoreActorVisuals(input: CreateCoreActorsInput) {
  ensureButlerVisual(input)
  ensurePetVisual(input)
}

function ensureButlerVisual(input: CreateCoreActorsInput) {
  if (!input.registry.butler) {
    const container = new Container()
    const graphic = new Graphics()
    const label = new Text({
      text: "管家",
      style: new TextStyle({
        fill: 0xe2e8f0,
        fontSize: 11,
      }),
    })

    label.x = -36
    label.y = -22
    label.visible = false

    container.addChild(graphic)
    container.addChild(label)

    input.registry.butler = {
      container,
      graphic,
      label,
    }

    input.layer.addChild(container)
    return
  }

  if (input.registry.butler.container.parent !== input.layer) {
    input.layer.addChild(input.registry.butler.container)
  }
}

function ensurePetVisual(input: CreateCoreActorsInput) {
  if (!input.registry.pet) {
    const container = new Container()
    const graphic = new Graphics()
    const label = new Text({
      text: "AI Pet",
      style: new TextStyle({
        fill: 0xf8fafc,
        fontSize: 11,
      }),
    })

    label.x = -12
    label.y = -24
    label.visible = false

    container.addChild(graphic)
    container.addChild(label)

    input.registry.pet = {
      container,
      graphic,
      label,
    }

    input.layer.addChild(container)
    return
  }

  if (input.registry.pet.container.parent !== input.layer) {
    input.layer.addChild(input.registry.pet.container)
  }
}