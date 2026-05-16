"use client"

/**
 * 当前文件负责：编排 HomeMapRenderModel 的分层渲染。
 */

import { WORLD_MAP_ASSETS } from "@/world/map-assets/world-map-asset-registry"

import type { HomeMapRenderModel } from "./home-map-render-model"
import { HomeMapPlacementSprite } from "./HomeMapPlacementSprite"
import { HOME_MAP_RENDER_STYLES } from "./home-map-render-styles"
import { GroundCanvasLayer } from "./layers/GroundCanvasLayer"
import { WORLD_RENDER_FEATURE_FLAGS } from "./rendering-feature-flags"

export type HomeMapRendererProps = {
  renderModel: HomeMapRenderModel
  worldTick: number
}

export function HomeMapRenderer({
  renderModel,
  worldTick,
}: HomeMapRendererProps) {
  const tileSize = renderModel.tileSize
  const mapWidth = renderModel.mapSize.columns * tileSize
  const mapHeight = renderModel.mapSize.rows * tileSize
  const shouldUseCanvasGround = WORLD_RENDER_FEATURE_FLAGS.useCanvasGround
  const domPlacements = shouldUseCanvasGround
    ? renderModel.dom.nonGroundPlacements
    : renderModel.allPlacements

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
          {shouldUseCanvasGround ? (
            <GroundCanvasLayer
              assetRegistry={WORLD_MAP_ASSETS}
              groundPlacements={renderModel.canvas.ground}
              mapSize={renderModel.mapSize}
              revisionKey={renderModel.canvasRevision}
              tileSize={tileSize}
            />
          ) : null}

          {domPlacements.map((placement) => (
            <HomeMapPlacementSprite
              key={placement.id}
              placement={placement}
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
