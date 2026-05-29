// 该组件用于在统一视觉 Debug 实验室中观察像素组合预览。

"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";

import {
  buildDefaultSceneComposerFact,
  buildSceneSvg,
  composeScene,
} from "@/world/procedural-painter/scene-composer/scene-composer-gateway";
import type {
  SceneComposerBiome,
  SceneComposerFact,
} from "@/world/procedural-painter/scene-composer/scene-composer-schema";

const BIOME_OPTIONS: SceneComposerBiome[] = ["forest", "grassland", "desert", "oasis"];
const DEFAULT_FACT = buildDefaultSceneComposerFact();

export default function PixelSceneComposerPanel() {
  const [fact, setFact] = useState<SceneComposerFact>(DEFAULT_FACT);
  const safeFact = useMemo(() => normalizeSceneComposerFact(fact), [fact]);
  const sceneSvg = useMemo(() => buildSceneSvg(safeFact), [safeFact]);
  const plan = useMemo(() => composeScene(safeFact), [safeFact]);

  function updateBiome(event: ChangeEvent<HTMLSelectElement>) {
    setFact((current) => ({
      ...normalizeSceneComposerFact(current),
      biome: event.target.value as SceneComposerBiome,
    }));
  }

  function updateNumberField(field: "moisture" | "decorationDensity" | "traceShape") {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setFact((current) => ({
        ...normalizeSceneComposerFact(current),
        [field]: Number(event.target.value),
      }));
    };
  }

  function updateSeed(event: ChangeEvent<HTMLInputElement>) {
    setFact((current) => ({
      ...normalizeSceneComposerFact(current),
      worldSeed: event.target.value,
    }));
  }

  function randomizeSeed() {
    const suffix = Math.random().toString(36).slice(2, 10);
    setFact((current) => ({
      ...normalizeSceneComposerFact(current),
      worldSeed: `ai_pet_world_scene_seed_${suffix}`,
    }));
  }

  function resetFact() {
    setFact(DEFAULT_FACT);
  }

  return (
    <section style={styles.panel}>
      <aside style={styles.controlPanel}>
        <h2 style={styles.panelTitle}>场景组合参数</h2>

        <label style={styles.fieldGroup}>
          <span style={styles.fieldLabel}>biome</span>
          <select value={safeFact.biome} onChange={updateBiome} style={styles.selectInput}>
            {BIOME_OPTIONS.map((biome) => (
              <option key={biome} value={biome}>{biome}</option>
            ))}
          </select>
        </label>

        <RangeControl label="moisture" value={safeFact.moisture} onChange={updateNumberField("moisture")} />
        <RangeControl label="decorationDensity" value={safeFact.decorationDensity} onChange={updateNumberField("decorationDensity")} />
        <RangeControl label="traceShape" value={safeFact.traceShape} onChange={updateNumberField("traceShape")} />

        <label style={styles.fieldGroup}>
          <span style={styles.fieldLabel}>worldSeed</span>
          <input value={safeFact.worldSeed} onChange={updateSeed} style={styles.textInput} />
        </label>

        <div style={styles.buttonRow}>
          <button type="button" onClick={randomizeSeed} style={styles.button}>随机 seed</button>
          <button type="button" onClick={resetFact} style={styles.secondaryButton}>重置</button>
        </div>
      </aside>

      <section style={styles.previewPanel}>
        <article style={styles.card}>
          <h2 style={styles.panelTitle}>场景预览</h2>
          <Image alt="Pixel scene composer preview" height={432} src={toSvgDataUri(sceneSvg)} style={styles.sceneImage} unoptimized width={768} />
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>算法输出摘要</h2>
          <dl style={styles.debugList}>
            <DebugRow label="biome" value={plan.biome} />
            <DebugRow label="moisture" value={plan.moisture} />
            <DebugRow label="decorationDensity" value={plan.decorationDensity} />
            <DebugRow label="trace shape" value={plan.traceShape} />
            <DebugRow label="grass tiles" value={plan.summary.grassTiles} />
            <DebugRow label="pressed grass" value={plan.summary.pressedGrassTiles} />
            <DebugRow label="worn grass" value={plan.summary.wornGrassTiles} />
            <DebugRow label="objects" value={plan.summary.trees + plan.summary.bushes + plan.summary.stones + plan.summary.flowers + plan.summary.mushrooms} />
          </dl>
        </article>
      </section>
    </section>
  );
}

function RangeControl({ label, value, onChange }: { label: string; value: number; onChange: (event: ChangeEvent<HTMLInputElement>) => void; }) {
  return (
    <label style={styles.fieldGroup}>
      <span style={styles.fieldLabel}>{label}</span>
      <input min={0} max={100} type="range" value={value} onChange={onChange} />
      <span style={styles.valuePill}>{value}</span>
    </label>
  );
}

function DebugRow({ label, value }: { label: string | number; value: string | number }) {
  return <div style={styles.debugRow}><dt>{label}</dt><dd>{value}</dd></div>;
}

function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeSceneComposerFact(fact: SceneComposerFact & { density?: number; pathCurve?: number; roadShape?: number }): SceneComposerFact {
  return {
    id: fact.id ?? DEFAULT_FACT.id,
    biome: BIOME_OPTIONS.includes(fact.biome) ? fact.biome : DEFAULT_FACT.biome,
    moisture: normalizeRangeValue(fact.moisture, DEFAULT_FACT.moisture),
    decorationDensity: normalizeRangeValue(fact.decorationDensity ?? fact.density, DEFAULT_FACT.decorationDensity),
    traceShape: normalizeRangeValue(fact.traceShape ?? fact.roadShape ?? fact.pathCurve, DEFAULT_FACT.traceShape),
    traceDensity: normalizeRangeValue(fact.traceDensity, DEFAULT_FACT.traceDensity),
    worldSeed: fact.worldSeed ?? DEFAULT_FACT.worldSeed,
    hasTraceFact: fact.hasTraceFact ?? DEFAULT_FACT.hasTraceFact,
    traceFacts: fact.traceFacts ?? DEFAULT_FACT.traceFacts,
    includeActorPlaceholder: fact.includeActorPlaceholder ?? DEFAULT_FACT.includeActorPlaceholder,
    factObjects: fact.factObjects ?? DEFAULT_FACT.factObjects,
  };
}

function normalizeRangeValue(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

const styles = {
  panel: { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: "18px", padding: "20px", color: "#eef7ef" },
  controlPanel: { position: "sticky", top: "20px", alignSelf: "start", padding: "18px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "20px", background: "rgba(8, 18, 15, 0.64)" },
  previewPanel: { display: "grid", gap: "18px" },
  card: { padding: "18px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "20px", background: "rgba(8, 18, 15, 0.58)" },
  panelTitle: { margin: "0 0 14px", fontSize: "18px" },
  fieldGroup: { display: "grid", gap: "8px", marginTop: "16px" },
  fieldLabel: { color: "#d8ead8", fontSize: "13px", fontWeight: 700 },
  selectInput: { width: "100%", padding: "10px 12px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#eef7ef", background: "#17231f" },
  textInput: { width: "100%", padding: "10px 12px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#eef7ef", background: "#17231f" },
  valuePill: { justifySelf: "start", padding: "4px 9px", borderRadius: "999px", color: "#16301f", background: "#9fceaa", fontSize: "12px", fontWeight: 800 },
  buttonRow: { display: "flex", gap: "10px", marginTop: "18px" },
  button: { padding: "10px 14px", border: 0, borderRadius: "12px", color: "#102119", background: "#9fceaa", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { padding: "10px 14px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#d8ead8", background: "rgba(255, 255, 255, 0.06)", fontWeight: 800, cursor: "pointer" },
  sceneImage: { display: "block", width: "100%", maxWidth: "960px", height: "auto", borderRadius: "16px", imageRendering: "pixelated", background: "#17231f" },
  debugList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", margin: 0 },
  debugRow: { padding: "10px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.055)" },
} satisfies Record<string, CSSProperties>;
