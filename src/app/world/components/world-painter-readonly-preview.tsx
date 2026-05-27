import Image from "next/image"

import type { WorldPainterFactAdapterResult } from "@/world/procedural-painter/world-painter-adapter/world-painter-fact-adapter"

import styles from "./world-painter-readonly-preview.module.css"

export function WorldPainterReadonlyPreview(input: {
  adapterResult: WorldPainterFactAdapterResult
  sceneSvg: string
}) {
  const sceneFact = input.adapterResult.sceneFact
  const summary = input.adapterResult.sourceSummary
  const hasMovementTraceFacts = sceneFact.hasTraceFact !== false && summary.movementTraces > 0
  const traceShapeValue = hasMovementTraceFacts
    ? String(sceneFact.traceShape)
    : "inactive"

  return (
    <section className={styles.worldPainterPanel} aria-label="Pixel World View fact-bound candidate">
      <div className={styles.worldPainterHeader}>
        <div>
          <div className={styles.worldPainterEyebrow}>PIXEL WORLD VIEW / FACT-BOUND CANDIDATE</div>
          <h2>Pixel world generated from HomeMapState</h2>
          <p>
            This candidate view reads saved HomeMapState facts and binds visible
            placements into the pixel scene. It does not create placements,
            pets, or runtime changes.
          </p>
        </div>
        <div className={styles.worldPainterFactGrid}>
          <WorldPainterFactItem label="biome" value={sceneFact.biome} />
          <WorldPainterFactItem label="moisture" value={String(sceneFact.moisture)} />
          <WorldPainterFactItem
            label="decorationDensity"
            value={String(sceneFact.decorationDensity)}
          />
          <WorldPainterFactItem label="trace shape" value={traceShapeValue} />
          <WorldPainterFactItem
            label="trace density"
            value={String(sceneFact.traceDensity)}
          />
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
              label="movement trace placements"
              value={String(summary.movementTracePlacements)}
            />
            <WorldPainterFactItem
              label="structure placements"
              value={String(summary.structurePlacements)}
            />
            <WorldPainterFactItem
              label="bound fact objects"
              value={String(summary.boundFactObjects)}
            />
            <WorldPainterFactItem
              label="skipped fact objects"
              value={String(summary.skippedFactObjects)}
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
            <WorldPainterFactItem
              label="space cells"
              value={String(summary.spaceCells)}
            />
            <WorldPainterFactItem
              label="passable cells"
              value={String(summary.passableCells)}
            />
            <WorldPainterFactItem
              label="blocked cells"
              value={String(summary.blockedCells)}
            />
            <WorldPainterFactItem
              label="restricted cells"
              value={String(summary.restrictedCells)}
            />
            <WorldPainterFactItem
              label="occupied cells"
              value={String(summary.occupiedCells)}
            />
            <WorldPainterFactItem
              label="avg movement cost"
              value={String(summary.averageMovementCost)}
            />
            <WorldPainterFactItem
              label="avg trace strength"
              value={String(summary.averageTraceStrength)}
            />
            <WorldPainterFactItem
              label="trace facts"
              value={String(summary.traceFacts)}
            />
            <WorldPainterFactItem
              label="spatial use traces"
              value={String(summary.spatialUseTraces)}
            />
            <WorldPainterFactItem
              label="movement traces"
              value={String(summary.movementTraces)}
            />
            <WorldPainterFactItem
              label="ecology change traces"
              value={String(summary.ecologyChangeTraces)}
            />
            <WorldPainterFactItem
              label="weak traces"
              value={String(summary.weakTraces)}
            />
            <WorldPainterFactItem
              label="medium traces"
              value={String(summary.mediumTraces)}
            />
            <WorldPainterFactItem
              label="strong traces"
              value={String(summary.strongTraces)}
            />
            <WorldPainterFactItem
              label="landmark traces"
              value={String(summary.landmarkTraces)}
            />
            <WorldPainterFactItem
              label="avg trace fact strength"
              value={String(summary.averageTraceFactStrength)}
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
