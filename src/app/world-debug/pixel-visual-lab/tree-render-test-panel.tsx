// 该组件用于在统一视觉 Debug 实验室中观察单棵树木绘制参数。

"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";

import {
  buildDefaultPixelTreeFact,
  type PixelTreeBiome,
  type PixelTreeWorldFact,
} from "@/world/procedural-painter/tree/tree-render-test-module";
import { buildPixelTreeSvgPreview } from "@/world/procedural-painter/tree/tree-render-test-preview";
import { buildPixelClusterTreeSvg } from "@/world/procedural-painter/tree/tree-cluster-art-preview";

const BIOME_OPTIONS: PixelTreeBiome[] = ["forest", "grassland", "desert", "oasis"];

const DEFAULT_FACT = buildDefaultPixelTreeFact({
  id: "tree_interactive_preview",
  x: 160,
  y: 254,
  biome: "forest",
  growth: 84,
  health: 90,
  moisture: 74,
  age: 28,
  worldSeed: "ai_pet_world_interactive_tree_seed_001",
});

export default function TreeRenderTestPanel() {
  const [fact, setFact] = useState<PixelTreeWorldFact>(DEFAULT_FACT);

  const preview = useMemo(
    () =>
      buildPixelTreeSvgPreview(fact, {
        width: 320,
        height: 320,
        background: "soft_ground",
        title: "AI-PET-WORLD procedural tree preview",
        showDebugLabel: true,
      }),
    [fact]
  );

  const livePreviewSvg = useMemo(() => buildPixelClusterTreeSvg(fact), [fact]);

  function updateBiome(event: ChangeEvent<HTMLSelectElement>) {
    setFact((current) => ({
      ...current,
      biome: event.target.value as PixelTreeBiome,
    }));
  }

  function updateNumberField(field: "growth" | "health" | "moisture" | "age") {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setFact((current) => ({
        ...current,
        [field]: Number(event.target.value),
      }));
    };
  }

  function updateSeed(event: ChangeEvent<HTMLInputElement>) {
    setFact((current) => ({
      ...current,
      worldSeed: event.target.value,
    }));
  }

  function randomizeSeed() {
    const suffix = Math.random().toString(36).slice(2, 10);
    setFact((current) => ({
      ...current,
      worldSeed: `ai_pet_world_tree_seed_${suffix}`,
    }));
  }

  function resetFact() {
    setFact(DEFAULT_FACT);
  }

  return (
    <section style={styles.panel}>
      <aside style={styles.controlPanel}>
        <h2 style={styles.panelTitle}>树木绘制参数</h2>

        <label style={styles.fieldGroup}>
          <span style={styles.fieldLabel}>biome</span>
          <select value={fact.biome} onChange={updateBiome} style={styles.selectInput}>
            {BIOME_OPTIONS.map((biome) => (
              <option key={biome} value={biome}>{biome}</option>
            ))}
          </select>
        </label>

        <RangeControl label="growth" value={fact.growth} onChange={updateNumberField("growth")} />
        <RangeControl label="health" value={fact.health} onChange={updateNumberField("health")} />
        <RangeControl label="moisture" value={fact.moisture} onChange={updateNumberField("moisture")} />

        <label style={styles.fieldGroup}>
          <span style={styles.fieldLabel}>age</span>
          <input min={0} max={120} type="range" value={fact.age} onChange={updateNumberField("age")} />
          <span style={styles.valuePill}>{fact.age}</span>
        </label>

        <label style={styles.fieldGroup}>
          <span style={styles.fieldLabel}>worldSeed</span>
          <input value={fact.worldSeed} onChange={updateSeed} style={styles.textInput} />
        </label>

        <div style={styles.buttonRow}>
          <button type="button" onClick={randomizeSeed} style={styles.button}>随机 seed</button>
          <button type="button" onClick={resetFact} style={styles.secondaryButton}>重置</button>
        </div>
      </aside>

      <section style={styles.previewPanel}>
        <article style={styles.card}>
          <h2 style={styles.panelTitle}>单树预览</h2>
          <p style={styles.note}>只测试树本体。允许投影阴影，不包含草地、草根、前景草或场景融合。</p>
          <Image alt="Procedural single pixel tree preview" height={320} src={toSvgDataUri(livePreviewSvg)} style={styles.previewImage} unoptimized width={320} />
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>算法输出摘要</h2>
          <dl style={styles.debugList}>
            <DebugRow label="biome" value={preview.summary.biome} />
            <DebugRow label="growth" value={preview.summary.growth} />
            <DebugRow label="health" value={preview.summary.health} />
            <DebugRow label="moisture" value={preview.summary.moisture} />
            <DebugRow label="growthStage" value={preview.test.perception.growthStage} />
            <DebugRow label="healthState" value={preview.test.perception.healthState} />
            <DebugRow label="speciesStyle" value={preview.test.decision.speciesStyle} />
            <DebugRow label="draw commands" value={preview.summary.commandCount} />
          </dl>
        </article>
      </section>
    </section>
  );
}

function RangeControl({ label, value, onChange }: { label: string; value: number; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label style={styles.fieldGroup}>
      <span style={styles.fieldLabel}>{label}</span>
      <input min={0} max={100} type="range" value={value} onChange={onChange} />
      <span style={styles.valuePill}>{value}</span>
    </label>
  );
}

function DebugRow({ label, value }: { label: string; value: string | number }) {
  return <div style={styles.debugRow}><dt>{label}</dt><dd>{value}</dd></div>;
}

function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const styles = {
  panel: { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: "18px", padding: "20px", color: "#eef7ef" },
  controlPanel: { position: "sticky", top: "20px", alignSelf: "start", padding: "18px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "20px", background: "rgba(8, 18, 15, 0.64)" },
  previewPanel: { display: "grid", gap: "18px" },
  card: { padding: "18px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "20px", background: "rgba(8, 18, 15, 0.58)" },
  panelTitle: { margin: "0 0 14px", fontSize: "18px" },
  note: { margin: "0 0 14px", color: "#aebfb2", fontSize: "13px", lineHeight: 1.6 },
  fieldGroup: { display: "grid", gap: "8px", marginTop: "16px" },
  fieldLabel: { color: "#d8ead8", fontSize: "13px", fontWeight: 700 },
  selectInput: { width: "100%", padding: "10px 12px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#eef7ef", background: "#17231f" },
  textInput: { width: "100%", padding: "10px 12px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#eef7ef", background: "#17231f" },
  valuePill: { justifySelf: "start", padding: "4px 9px", borderRadius: "999px", color: "#16301f", background: "#9fceaa", fontSize: "12px", fontWeight: 800 },
  buttonRow: { display: "flex", gap: "10px", marginTop: "18px" },
  button: { padding: "10px 14px", border: 0, borderRadius: "12px", color: "#102119", background: "#9fceaa", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { padding: "10px 14px", border: "1px solid rgba(191, 225, 196, 0.24)", borderRadius: "12px", color: "#d8ead8", background: "rgba(255, 255, 255, 0.06)", fontWeight: 800, cursor: "pointer" },
  previewImage: { display: "block", width: "100%", maxWidth: "360px", height: "auto", margin: "0 auto", borderRadius: "16px", imageRendering: "pixelated", background: "#17231f" },
  debugList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", margin: 0 },
  debugRow: { padding: "10px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.055)" },
} satisfies Record<string, CSSProperties>;
