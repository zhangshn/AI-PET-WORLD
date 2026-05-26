import Image from "next/image"

import type { WorldPainterFactAdapterResult } from "@/world/procedural-painter/world-painter-adapter/world-painter-fact-adapter"

import styles from "./world-painter-readonly-preview.module.css"

export function WorldPainterReadonlyPreview(input: {
  adapterResult: WorldPainterFactAdapterResult
  sceneSvg: string
}) {
  const sceneFact = input.adapterResult.sceneFact
  const summary = input.adapterResult.sourceSummary
  const hasPathPlacements = summary.pathPlacements > 0
  const roadShapeValue = hasPathPlacements ? String(sceneFact.roadShape) : "none"

  return (
    <section className={styles.worldPainterPanel} aria-label="World Painter readonly preview">
      <div className={styles.worldPainterHeader}>
        <div>
          <div className={styles.worldPainterEyebrow}>WORLD PAINTER / READONLY PREVIEW</div>
          <h2>Pixel world generated from saved facts</h2>
          <p>
            This preview reads the current HomeMapState through a read-only adapter.
            It does not create placements, world facts, pets, or runtime changes.
          </p>
        </div>
        <div className={styles.worldPainterFactGrid}>
          <WorldPainterFactItem label="biome" value={sceneFact.biome} />
          <WorldPainterFactItem label="moisture" value={String(sceneFact.moisture)} />
          <WorldPainterFactItem
            label="decorationDensity"
            value={String(sceneFact.decorationDensity)}
          />
          <WorldPainterFactItem label="roadShape" value={roadShapeValue} />
        </div>
      </div>

      <div className={styles.worldPainterPreviewGrid}>
        <div className={styles.worldPainterSceneFrame}>
          <Image
            alt="Pixel world painter preview generated from HomeMapState"
            height={432}
            src={toSvgDataUri(input.sceneSvg)}
            unoptimized
            width={768}
          />
        </div>
        <div className={styles.worldPainterSourcePanel}>
          <h3>Read-only source facts</h3>
          <div className={styles.worldPainterSourceList}>
            <WorldPainterFactItem label="world" value={summary.worldId} />
            <WorldPainterFactItem
              label="natural placements"
              value={String(summary.naturalPlacements)}
            />
            <WorldPainterFactItem
              label="path placements"
              value={String(summary.pathPlacements)}
            />
            <WorldPainterFactItem
              label="structure placements"
              value={String(summary.structurePlacements)}
            />
            <WorldPainterFactItem label="map diffs" value={String(summary.mapDiffs)} />
            <WorldPainterFactItem
              label="ground health"
              value={String(summary.groundHealth)}
            />
            <WorldPainterFactItem
              label="natural growth"
              value={String(summary.naturalGrowth)}
            />
            <WorldPainterFactItem
              label="space pressure"
              value={String(summary.spacePressure)}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function WorldPainterFactItem(input: { label: string; value: string }) {
  return (
    <div className={styles.worldPainterFactItem}>
      <strong>{input.label}</strong>
      <span>{input.value}</span>
    </div>
  )
}

function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}