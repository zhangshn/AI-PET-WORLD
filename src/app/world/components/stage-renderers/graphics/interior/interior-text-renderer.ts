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
    text: "这里保留为第一个宠物的抵达照护点；未来领养与繁殖会进入独立系统。",
    style: new TextStyle({
      fill: 0xcbd5e1,
      fontSize: 11,
    }),
  })

  hint.x = 92
  hint.y = 96
  layer.addChild(hint)
}
