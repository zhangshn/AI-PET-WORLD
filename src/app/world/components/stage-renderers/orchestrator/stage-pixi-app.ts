/**
 * 当前文件负责：创建、挂载与销毁 Pixi 世界舞台应用。
 */

import { Application } from "pixi.js"

import { WORLD_STAGE_SIZE } from "../config/stage-size-config"

export async function createWorldPixiApplication(): Promise<Application> {
  const app = new Application()

  await app.init({
    width: WORLD_STAGE_SIZE.width,
    height: WORLD_STAGE_SIZE.height,
    backgroundAlpha: 0,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  return app
}

export function attachWorldPixiCanvas(input: {
  mount: HTMLDivElement
  app: Application
}) {
  input.mount.appendChild(input.app.canvas)
}

export function destroyWorldPixiApplication(app: Application | null) {
  if (!app) return

  app.destroy(true, {
    children: true,
    texture: true,
  })
}