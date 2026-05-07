/**
 * 当前文件负责：组合 /world 圆形小地图。
 */

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { WorldHudBundle } from "../../utils/worldHudMappers"

import WorldMiniMapMarkers from "./WorldMiniMapMarkers"
import { buildWorldMiniMapViewModel } from "./worldMiniMapMappers"

import styles from "@/styles/world-styles/minimap/world-mini-map.module.css"

type Props = {
  world: WorldEngineViewState
  hud: WorldHudBundle
}

export default function WorldMiniMap({ world, hud }: Props) {
  const viewModel = buildWorldMiniMapViewModel({
    world,
    hud,
  })

  return (
    <aside className={styles.minimap} aria-label="世界小地图">
      <div className={styles.mapCircle}>
        <div className={styles.mapInner}>
          <div className={styles.scanGrid} />
          <div className={styles.homePatch} />
          <div className={styles.waterPatch} />
          <div className={styles.pathCurve} />

          <WorldMiniMapMarkers markers={viewModel.markers} />
        </div>

        <div className={styles.compass}>
          <span>N</span>
        </div>
      </div>
    </aside>
  )
}