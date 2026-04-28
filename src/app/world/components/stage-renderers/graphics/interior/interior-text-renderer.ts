/**
 * 当前文件负责：渲染住所室内标题与提示文本。
 */

import { Container, Text, TextStyle } from "pixi.js"

export function drawInteriorText(layer: Container) {
  const title = new Text({
    text: "住所内部 · 初始生命舱",
    style: new TextStyle({
      fill: 0xf8fafc,
      fontSize: 15,
      fontWeight: "600",
    }),
  })

  title.x = 92
  title.y = 72
  layer.addChild(title)

  const hint = new Text({
    text: "孵化器是第一个宠物的生命起点；未来繁殖将进入独立的新生照护系统。",
    style: new TextStyle({
      fill: 0xcbd5e1,
      fontSize: 11,
    }),
  })

  hint.x = 92
  hint.y = 96
  layer.addChild(hint)
}