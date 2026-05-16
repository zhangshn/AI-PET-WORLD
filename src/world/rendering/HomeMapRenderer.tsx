"use client"

/**
 * 当前文件负责：编排 HomeMapRenderModel 的分层渲染。
 */

import type { HomeMapRenderModel } from "./home-map-render-model"
import { HOME_MAP_RENDER_STYLES } from "./home-map-render-styles"
import { ActorLayer } from "./layers/ActorLayer"
import { AtmosphereLayer } from "./layers/AtmosphereLayer"
import { DecalLayer } from "./layers/DecalLayer"
import { EntityLayer } from "./layers/EntityLayer"
import { GroundTileLayer } from "./layers/GroundTileLayer"
import { PathAutotileLayer } from "./layers/PathAutotileLayer"

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
  const entityPlacements = [
    ...renderModel.structurePlacements,
    ...renderModel.facilityPlacements,
    ...renderModel.naturePlacements,
  ]

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
          <GroundTileLayer
            height={mapHeight}
            placements={renderModel.groundPlacements}
            tileSize={tileSize}
            width={mapWidth}
          />
          <PathAutotileLayer
            edgePlacements={renderModel.edgePlacements}
            height={mapHeight}
            pathPlacements={renderModel.pathPlacements}
            tileSize={tileSize}
            width={mapWidth}
          />
          <DecalLayer
            height={mapHeight}
            placements={renderModel.surfaceDecorationPlacements}
            tileSize={tileSize}
            width={mapWidth}
          />
          <EntityLayer
            height={mapHeight}
            placements={entityPlacements}
            tileSize={tileSize}
            width={mapWidth}
          />
          <ActorLayer
            height={mapHeight}
            placements={renderModel.actorPlacements}
            tileSize={tileSize}
            width={mapWidth}
          />
          <AtmosphereLayer height={mapHeight} width={mapWidth} />

          <span style={HOME_MAP_RENDER_STYLES.hiddenStatus}>
            {`world tick ${worldTick}; placements ${renderModel.debugInfo.placementCount}`}
          </span>
        </div>
      </section>
    </main>
  )
}
