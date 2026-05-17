"use client"

/**
 * Renders the HomeMapRenderModel as the visible world stage.
 */

import { WORLD_MAP_ASSETS } from "@/world/map-assets/world-map-asset-registry"

import type { HomeMapRenderModel } from "./home-map-render-model"
import { HomeMapPlacementSprite } from "./HomeMapPlacementSprite"
import { HOME_MAP_RENDER_STYLES } from "./home-map-render-styles"
import { DecalLayer } from "./layers/DecalLayer"
import { PathAutotileLayer } from "./layers/PathAutotileLayer"
import { WORLD_RENDER_FEATURE_FLAGS } from "./rendering-feature-flags"

export type HomeMapRendererProps = {
  renderModel: HomeMapRenderModel
  worldTick: number
}

export function HomeMapRenderer({ renderModel }: HomeMapRendererProps) {
  const tileSize = renderModel.tileSize
  const mapWidth = renderModel.mapSize.columns * tileSize
  const mapHeight = renderModel.mapSize.rows * tileSize
  const shouldUseCanvasPath = WORLD_RENDER_FEATURE_FLAGS.useCanvasPath
  const shouldUseCanvasEdge = WORLD_RENDER_FEATURE_FLAGS.useCanvasEdge
  const shouldUseCanvasDecal = WORLD_RENDER_FEATURE_FLAGS.useCanvasDecal
  const domPlacements = getDomPlacements(renderModel)

  return (
    <div
      aria-label="AI-PET-WORLD initial home"
      style={HOME_MAP_RENDER_STYLES.renderer}
    >
      <div
        style={{
          ...HOME_MAP_RENDER_STYLES.mapCanvas,
          height: mapHeight,
          width: mapWidth,
        }}
      >
        {shouldUseCanvasPath || shouldUseCanvasEdge ? (
          <PathAutotileLayer
            assetRegistry={WORLD_MAP_ASSETS}
            edgePlacements={shouldUseCanvasEdge ? renderModel.canvas.edge : []}
            mapSize={renderModel.mapSize}
            pathPlacements={shouldUseCanvasPath ? renderModel.canvas.path : []}
            revisionKey={[
              shouldUseCanvasPath ? renderModel.canvasRevisions.path : "",
              shouldUseCanvasEdge ? renderModel.canvasRevisions.edge : "",
            ].join("|")}
            tileSize={tileSize}
          />
        ) : null}

        {shouldUseCanvasDecal ? (
          <DecalLayer
            assetRegistry={WORLD_MAP_ASSETS}
            mapSize={renderModel.mapSize}
            placements={renderModel.canvas.decal}
            revisionKey={renderModel.canvasRevisions.decal}
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
      </div>
    </div>
  )
}

function getDomPlacements(renderModel: HomeMapRenderModel) {
  return renderModel.allPlacements.filter((placement) => {
    if (
      placement.layer === "ground" &&
      !WORLD_RENDER_FEATURE_FLAGS.renderGroundTiles
    ) {
      return false
    }

    if (placement.layer === "zone") {
      return false
    }

    if (placement.layer === "edge" && !WORLD_RENDER_FEATURE_FLAGS.useCanvasEdge) {
      return false
    }

    if (WORLD_RENDER_FEATURE_FLAGS.useCanvasPath && placement.layer === "path") {
      return false
    }

    if (
      WORLD_RENDER_FEATURE_FLAGS.useCanvasDecal &&
      placement.layer === "surface-decoration"
    ) {
      return false
    }

    return true
  })
}
