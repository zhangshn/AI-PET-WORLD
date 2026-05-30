// 该组件用于在视觉 Debug 实验室中单独测试地面 Tile 绘制算法。

"use client";

import { useMemo, useState, type ChangeEvent, type CSSProperties } from "react";

import { renderFormalGroundTile } from "@/world/formal-pixel-renderer/formal-ground-recipe";
import type { FormalPixelTileRenderItem } from "@/world/formal-pixel-renderer/formal-pixel-renderer-schema";
import type { WorldViewTileKind } from "@/world/world-view-model/world-view-model-schema";

const TILE_KINDS: WorldViewTileKind[] = [
  "grass",
  "pressed_grass",
  "worn_grass",
  "exposed_soil",
  "ecology_transition",
  "recovery_growth",
  "soil",
  "built",
  "boundary",
];

export default function GroundTileTestPanel() {
  const [tileKind, setTileKind] = useState<WorldViewTileKind>("grass");
  const [traceIntensity, setTraceIntensity] = useState(18);
  const [variant, setVariant] = useState(3);
  const [seed, setSeed] = useState("ai_pet_world_ground_recipe_seed_001");

  const singleTileSvg = useMemo(
    () => buildSingleTileSvg(tileKind, traceIntensity, variant, seed),
    [tileKind, traceIntensity, variant, seed]
  );
  const patchSvg = useMemo(
    () => buildTilePatchSvg(tileKind, traceIntensity, variant, seed),
    [tileKind, traceIntensity, variant, seed]
  );

  function updateTileKind(event: ChangeEvent<HTMLSelectElement>) {
    setTileKind(event.target.value as WorldViewTileKind);
  }

  function updateNumberField(setter: (value: number) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => setter(Number(event.target.value));
  }

  function randomizeSeed() {
    setSeed(`ai_pet_world_ground_recipe_seed_${Date.now().toString(36)}`);
  }

  function reset() {
    setTileKind("grass");
    setTraceIntensity(18);
    setVariant(3);
    setSeed("ai_pet_world_ground_recipe_seed_001");
  }

  return (
    <section style={styles.panel}>
      <aside style={styles.controlPanel}>
        <h2 style={styles.panelTitle}>地面绘制参数</h2>

        <label style={styles.fieldGroup}>
          <span style={styles.fieldLabel}>tileKind</span>
          <select value={tileKind} onChange={updateTileKind} style={styles.selectInput}>
            {TILE_KINDS.map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
        </label>

        <RangeControl label="traceIntensity" value={traceIntensity} onChange={updateNumberField(setTraceIntensity)} />
        <RangeControl label="variant" value={variant} max={12} onChange={updateNumberField(setVariant)} />

        <label style={styles.fieldGroup}>
          <span style={styles.fieldLabel}>seed</span>
          <input value={seed} onChange={(event) => setSeed(event.target.value)} style={styles.textInput} />
        </label>

        <div style={styles.buttonRow}>
          <button type="button" onClick={randomizeSeed} style={styles.button}>随机 seed</button>
          <button type="button" onClick={reset} style={styles.secondaryButton}>重置</button>
        </div>
      </aside>

      <section style={styles.previewPanel}>
        <article style={styles.card}>
          <h2 style={styles.panelTitle}>单 Tile 预览</h2>
          <img alt="Formal ground tile preview" src={toSvgDataUri(singleTileSvg)} style={styles.singleImage} />
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>Tile Patch 组合预览</h2>
          <img alt="Formal ground tile patch preview" src={toSvgDataUri(patchSvg)} style={styles.patchImage} />
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>算法输出摘要</h2>
          <dl style={styles.debugList}>
            <DebugRow label="recipe" value="formal_ground_recipe_v1" />
            <DebugRow label="tileKind" value={tileKind} />
            <DebugRow label="traceIntensity" value={traceIntensity} />
            <DebugRow label="variant" value={variant} />
            <DebugRow label="seed" value={seed} />
          </dl>
        </article>
      </section>
    </section>
  );
}

function RangeControl({
  label,
  max = 100,
  value,
  onChange,
}: {
  label: string;
  max?: number;
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label style={styles.fieldGroup}>
      <span style={styles.fieldLabel}>{label}</span>
      <input min={0} max={max} type="range" value={value} onChange={onChange} />
      <span style={styles.valuePill}>{value}</span>
    </label>
  );
}

function DebugRow({ label, value }: { label: string; value: string | number }) {
  return <div style={styles.debugRow}><dt>{label}</dt><dd>{value}</dd></div>;
}

function buildSingleTileSvg(kind: WorldViewTileKind, traceIntensity: number, variant: number, seed: string): string {
  const tile = buildTile({ id: `${seed}_single_${kind}_${variant}_${traceIntensity}`, kind, x: 48, y: 48, size: 160, traceIntensity, variant });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" shape-rendering="crispEdges" data-visual-lab-panel="ground-tile" data-formal-recipe="formal_ground_recipe_v1">`,
    `<rect x="0" y="0" width="256" height="256" fill="#17231f"/>`,
    renderFormalGroundTile(tile),
    `</svg>`,
  ].join("\n");
}

function buildTilePatchSvg(kind: WorldViewTileKind, traceIntensity: number, variant: number, seed: string): string {
  const tileSize = 32;
  const columns = 12;
  const rows = 8;
  const random = seededRandom(`${seed}:${kind}:${traceIntensity}:${variant}:ground-patch-preview`);
  const tiles = Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const patchKind = pickPatchKind(kind, random);
    const patchTrace = Math.max(0, Math.min(100, traceIntensity + Math.round((random() - 0.5) * 34)));

    return buildTile({
      id: `${seed}_patch_${index}_${patchKind}`,
      kind: patchKind,
      x: column * tileSize,
      y: row * tileSize,
      size: tileSize,
      traceIntensity: patchTrace,
      variant: (variant + index) % 13,
    });
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="384" height="256" viewBox="0 0 384 256" shape-rendering="crispEdges" data-visual-lab-panel="ground-patch" data-formal-recipe="formal_ground_recipe_v1">`,
    `<rect x="0" y="0" width="384" height="256" fill="#17231f"/>`,
    ...tiles.map(renderFormalGroundTile),
    `</svg>`,
  ].join("\n");
}

function buildTile(input: {
  id: string;
  kind: WorldViewTileKind;
  x: number;
  y: number;
  size: number;
  traceIntensity: number;
  variant: number;
}): FormalPixelTileRenderItem {
  return {
    id: input.id,
    layerKind: "tile",
    x: input.x,
    y: input.y,
    width: input.size,
    height: input.size,
    kind: input.kind,
    variant: input.variant,
    passable: input.kind !== "boundary",
    traceIntensity: input.traceIntensity,
    drawOrder: 1_000 + input.y,
    tags: ["visual_lab_ground_tile", `tile_kind_${input.kind}`],
  };
}

function pickPatchKind(baseKind: WorldViewTileKind, random: () => number): WorldViewTileKind {
  if (random() < 0.7) return baseKind;
  if (baseKind === "grass") return random() > 0.5 ? "ecology_transition" : "recovery_growth";
  if (baseKind === "pressed_grass") return random() > 0.5 ? "grass" : "worn_grass";
  if (baseKind === "worn_grass") return random() > 0.5 ? "pressed_grass" : "exposed_soil";
  if (baseKind === "exposed_soil") return random() > 0.5 ? "soil" : "worn_grass";
  if (baseKind === "soil") return random() > 0.5 ? "exposed_soil" : "built";
  if (baseKind === "boundary") return random() > 0.5 ? "boundary" : "built";
  return random() > 0.5 ? "grass" : baseKind;
}

function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seededRandom(seed: string): () => number {
  let state = hash(seed);
  return () => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string): number {
  let current = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }
  return current >>> 0;
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
  singleImage: { display: "block", width: "256px", height: "256px", borderRadius: "16px", imageRendering: "pixelated", background: "#17231f" },
  patchImage: { display: "block", width: "100%", maxWidth: "768px", height: "auto", borderRadius: "16px", imageRendering: "pixelated", background: "#17231f" },
  debugList: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", margin: 0 },
  debugRow: { padding: "10px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.055)" },
} satisfies Record<string, CSSProperties>;
