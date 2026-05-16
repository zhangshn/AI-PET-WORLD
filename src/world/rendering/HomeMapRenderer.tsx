"use client"

/**
 * 当前文件负责：编排 HomeMapRenderModel 的分层渲染。
 */

import type { HomeMapRenderModel } from "./home-map-render-model"
import { HomeMapPlacementSprite } from "./HomeMapPlacementSprite"
import { GroundCanvasLayer } from "./canvas/GroundCanvasLayer"
import { HOME_MAP_RENDER_STYLES } from "./home-map-render-styles"

export type HomeMapRendererProps = {
  renderModel: HomeMapRenderModel
  worldTick: number
}

export function HomeMapRenderer({
  renderModel,
  worldTick,
}: HomeMapRendererProps) {
  const tileSize = renderModel.mapSize.tileSize
  const mapWidth = renderModel.mapSize.columns * tileSize
  const mapHeight = renderModel.mapSize.rows * tileSize

  return (
    <main style={HOME_MAP_RENDER_STYLES.page}>
      <section
        style={HOME_MAP_RENDER_STYLES.viewport}
        aria-label="AI-PET-WORLD 初始家园"
      >
        <div
          style={{
            ...HOME_MAP_RENDER_STYLES.mapCanvas,
            height: mapHeight,
            width: mapWidth,
          }}
        >
          <GroundCanvasLayer input={renderModel.groundCanvas} />

          {renderModel.entityPlacements.map((placement) => (
            <HomeMapPlacementSprite
              key={placement.id}
              placement={placement}
              renderMode="entity"
              tileSize={tileSize}
            />
          ))}

          {renderModel.actorPlacements.map((placement) => (
            <HomeMapPlacementSprite
              key={placement.id}
              placement={placement}
              renderMode="actor"
              tileSize={tileSize}
            />
          ))}

          <div
            style={{
              ...HOME_MAP_RENDER_STYLES.dayNightAtmosphere,
              height: mapHeight,
              width: mapWidth,
            }}
          />

          <span style={HOME_MAP_RENDER_STYLES.hiddenStatus}>
            {`world tick ${worldTick}; placements ${renderModel.debugInfo.placementCount}`}
          </span>
        </div>
      </section>
    </main>
  )
}
