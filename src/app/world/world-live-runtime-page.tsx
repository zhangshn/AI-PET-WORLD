import { FormalPixelSvgView } from "@/app/world/components/formal-pixel-svg-view/formal-pixel-svg-view"
import { buildFormalPixelRenderModel } from "@/world/formal-pixel-renderer"
import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import { buildWorldViewModelForPixelWorld } from "@/world/world-view-model"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()
  const saveRecord = runtimeView.saveRecord
  const worldViewModel = buildWorldViewModelForPixelWorld({
    saveRecord,
    isPersisted: runtimeView.isPersisted,
  })
  const formalPixelRenderModel = buildFormalPixelRenderModel(worldViewModel)

  return <FormalPixelSvgView model={formalPixelRenderModel} />
}
