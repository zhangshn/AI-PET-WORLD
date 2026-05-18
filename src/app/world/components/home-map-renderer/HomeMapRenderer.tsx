/**
 * 当前文件职责：在 P6 ProceduralRenderer 接入前阻止旧贴图式世界渲染。
 */

import type { HomeMapState } from "@/world/map-state/home-map-state-schema"

export function HomeMapRenderer(input: { homeMapState: HomeMapState }) {
  return (
    <section aria-label="AI-PET-WORLD renderer paused">
      <h2>Renderer 已暂停：等待 P6 ProceduralRenderer v0 接入。</h2>
      <p>
        当前 HomeMapState 已生成，但本组件不会绘制树、房子、道路、装饰或假地图，也不会生成 placement 或修改状态。
      </p>
      <p>
        worldId: {input.homeMapState.worldId} / placements:{" "}
        {input.homeMapState.placements.length}
      </p>
    </section>
  )
}
