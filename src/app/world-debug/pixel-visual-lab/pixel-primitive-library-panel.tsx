// 该组件用于在视觉 Debug 实验室中测试像素原型库。

"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";

import {
  PIXEL_OBJECT_KINDS,
  PIXEL_PALETTE,
  buildPixelObjectRecipe,
  getPixelSemanticStructure,
  listPixelPrimitiveDefinitions,
  listPixelShapeDefinitions,
  renderPixelObjectToDataUri,
  type PixelObjectKind,
  type PixelPrimitiveDefinition,
  type PixelShapeDefinition,
} from "@/world/pixel-primitives";

const OBJECT_LABELS: Record<PixelObjectKind, string> = {
  tree: "树木",
  grass_tile: "草地",
  stone: "石头",
  insect: "昆虫",
  butler: "管家",
};

export default function PixelPrimitiveLibraryPanel() {
  const [selectedKind, setSelectedKind] = useState<PixelObjectKind>("tree");
  const primitives = useMemo(() => listPixelPrimitiveDefinitions(), []);
  const shapes = useMemo(() => listPixelShapeDefinitions(), []);
  const result = useMemo(() => buildPixelObjectRecipe(selectedKind), [selectedKind]);
  const semantic = getPixelSemanticStructure(selectedKind);
  const svgDataUri = useMemo(() => renderPixelObjectToDataUri(result), [result]);

  return (
    <section style={styles.panel}>
      <aside style={styles.sidebar}>
        <h2 style={styles.panelTitle}>像素原型库</h2>
        <p style={styles.description}>
          按“语义结构 → 像素形状 → 像素块”的顺序生成单体预览。本页只做视觉算法测试，不读取 runtime，不写入世界事实，不推进 Tick。
        </p>

        <section style={styles.blockSection}>
          <h3 style={styles.sectionTitle}>物品生成</h3>
          <div style={styles.buttonGrid}>
            {PIXEL_OBJECT_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setSelectedKind(kind)}
                style={selectedKind === kind ? styles.activeButton : styles.button}
              >
                {OBJECT_LABELS[kind]}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section style={styles.previewColumn}>
        <article style={styles.card}>
          <h2 style={styles.panelTitle}>基础像素块 / 原始方框</h2>
          <p style={styles.description}>这里展示最底层的方框语言：正方块、横条、竖条、点、线、阴影、高光等。</p>
          <div style={styles.primitiveGrid}>
            {primitives.map((primitive) => (
              <PrimitiveCard key={primitive.kind} primitive={primitive} />
            ))}
          </div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>基础像素形状 / 原始图形</h2>
          <p style={styles.description}>这里展示方块组合后的原始图形：叶子行、叶团、树干条、草点、石头团块、翅膀块、腿线等。</p>
          <div style={styles.shapeGrid}>
            {shapes.map((shape) => (
              <ShapeCard key={shape.id} shape={shape} />
            ))}
          </div>
        </article>

        <article style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.panelTitle}>单体生成预览：{result.label}</h2>
              <p style={styles.description}>Golden Recipe：{result.goldenAlgorithm ?? "pixel_object_recipe_v1"}</p>
            </div>
            <span style={result.validation.status === "pass" ? styles.passBadge : styles.failBadge}>
              Validator: {result.validation.status.toUpperCase()}
            </span>
          </div>

          <div style={styles.previewShell}>
            <Image
              alt={`${result.label} pixel primitive preview`}
              height={220}
              src={svgDataUri}
              style={styles.previewImage}
              unoptimized
              width={220}
            />
          </div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>语义结构</h2>
          <dl style={styles.debugGrid}>
            <DebugRow label="semantic" value={semantic.id} />
            <DebugRow label="anchor" value={semantic.anchorType} />
            <DebugRow label="requiredParts" value={semantic.requiredParts.join(", ")} />
            <DebugRow label="optionalParts" value={semantic.optionalParts.join(", ")} />
            <DebugRow label="forbiddenParts" value={semantic.forbiddenParts.join(", ")} />
            <DebugRow label="relation" value={semantic.relationSummary} />
          </dl>
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>Recipe 输出摘要</h2>
          <dl style={styles.debugGrid}>
            <DebugRow label="recipeId" value={result.recipeId} />
            <DebugRow label="version" value={result.recipeVersion} />
            <DebugRow label="anchor" value={`${result.anchor.type} (${result.anchor.x}, ${result.anchor.y})`} />
            <DebugRow label="bounds" value={`${result.bounds.x}, ${result.bounds.y}, ${result.bounds.width}×${result.bounds.height}`} />
            <DebugRow label="usedShapes" value={result.usedShapes.join(", ")} />
            <DebugRow label="usedParts" value={result.usedParts.join(", ")} />
            <DebugRow label="usedPrimitives" value={result.usedPrimitives.join(", ")} />
            <DebugRow label="blockCount" value={result.blocks.length} />
          </dl>
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>Validator 结果</h2>
          <ul style={styles.messageList}>
            {result.validation.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
}

function PrimitiveCard({ primitive }: { primitive: PixelPrimitiveDefinition }) {
  const sampleStyle = buildPrimitiveSampleStyle(primitive);

  return (
    <div style={styles.visualCard} data-primitive-card={primitive.kind}>
      <div style={styles.sampleStage}>
        <div style={sampleStyle} />
      </div>
      <strong style={styles.visualName}>{primitive.kind}</strong>
      <span style={styles.visualCaption}>{primitive.label}</span>
    </div>
  );
}

function ShapeCard({ shape }: { shape: PixelShapeDefinition }) {
  return (
    <div style={styles.visualCard} data-shape-card={shape.id}>
      <svg width="86" height="58" viewBox="0 0 86 58" shapeRendering="crispEdges" style={styles.shapeSvg}>
        <rect x="0" y="0" width="86" height="58" fill="#17231f" />
        {renderShapeSample(shape)}
      </svg>
      <strong style={styles.visualName}>{shape.id}</strong>
      <span style={styles.visualCaption}>{shape.label}</span>
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.debugRow}>
      <dt style={styles.debugLabel}>{label}</dt>
      <dd style={styles.debugValue}>{value}</dd>
    </div>
  );
}

function buildPrimitiveSampleStyle(primitive: PixelPrimitiveDefinition): CSSProperties {
  const base: CSSProperties = {
    width: `${primitive.defaultWidth}px`,
    height: `${primitive.defaultHeight}px`,
    imageRendering: "pixelated",
  };

  if (primitive.kind === "shadow_block") return { ...base, width: "42px", height: "12px", borderRadius: "999px", background: PIXEL_PALETTE.shadow, opacity: 0.5 };
  if (primitive.kind === "highlight_block") return { ...base, background: PIXEL_PALETTE.highlight };
  if (primitive.kind === "dark_block") return { ...base, background: PIXEL_PALETTE.leafDark };
  if (primitive.kind === "transparent_block") return { ...base, background: PIXEL_PALETTE.wing, opacity: 0.46 };
  if (primitive.kind === "noise_block") return { ...base, background: PIXEL_PALETTE.grassLight };
  if (primitive.kind === "line_block") return { ...base, background: PIXEL_PALETTE.insectDark };
  if (primitive.kind === "tall_block") return { ...base, background: PIXEL_PALETTE.trunk };
  if (primitive.kind === "wide_block") return { ...base, background: PIXEL_PALETTE.leaf };
  if (primitive.kind === "dot_block") return { ...base, background: PIXEL_PALETTE.highlight };
  return { ...base, background: PIXEL_PALETTE.stone };
}

function renderShapeSample(shape: PixelShapeDefinition) {
  const leafColor = PIXEL_PALETTE.leaf;
  const darkLeaf = PIXEL_PALETTE.leafDark;
  const grass = PIXEL_PALETTE.grassLight;
  const stone = PIXEL_PALETTE.stone;

  if (shape.id === "leaf_row") return <rect x="20" y="26" width="46" height="6" fill={leafColor} />;
  if (shape.id === "leaf_cluster") return <><rect x="26" y="16" width="30" height="6" fill={PIXEL_PALETTE.leafLight} /><rect x="18" y="24" width="48" height="7" fill={leafColor} /><rect x="24" y="32" width="38" height="7" fill={darkLeaf} /></>;
  if (shape.id === "trunk_strip") return <><rect x="38" y="12" width="12" height="36" fill={PIXEL_PALETTE.trunkDark} /><rect x="44" y="16" width="7" height="28" fill={PIXEL_PALETTE.trunk} /></>;
  if (shape.id === "shadow_patch") return <ellipse cx="43" cy="34" rx="28" ry="8" fill={PIXEL_PALETTE.shadow} opacity="0.45" />;
  if (shape.id === "highlight_chip") return <><rect x="34" y="24" width="16" height="5" fill={PIXEL_PALETTE.highlight} /><rect x="52" y="28" width="5" height="5" fill={PIXEL_PALETTE.highlight} /></>;
  if (shape.id === "grass_chip") return <><rect x="35" y="27" width="4" height="16" fill={grass} /><rect x="47" y="22" width="4" height="20" fill={PIXEL_PALETTE.grassDark} /><rect x="58" y="31" width="3" height="10" fill={grass} /></>;
  if (shape.id === "soil_chip") return <><rect x="30" y="29" width="8" height="4" fill={PIXEL_PALETTE.soil} /><rect x="45" y="34" width="4" height="4" fill={PIXEL_PALETTE.soilDark} /><rect x="58" y="25" width="3" height="3" fill={PIXEL_PALETTE.soil} /></>;
  if (shape.id === "worn_strip") return <rect x="22" y="28" width="44" height="8" fill={PIXEL_PALETTE.soil} opacity="0.55" />;
  if (shape.id === "pressed_mark") return <rect x="20" y="30" width="48" height="5" fill={PIXEL_PALETTE.grassDark} opacity="0.65" />;
  if (shape.id === "stone_cluster") return <><rect x="24" y="30" width="38" height="12" fill={PIXEL_PALETTE.stoneDark} /><rect x="30" y="22" width="30" height="13" fill={stone} /><rect x="36" y="24" width="16" height="4" fill={PIXEL_PALETTE.stoneLight} /></>;
  if (shape.id === "wing_chip") return <><rect x="24" y="22" width="18" height="10" fill={PIXEL_PALETTE.wing} opacity="0.45" /><rect x="46" y="22" width="18" height="10" fill={PIXEL_PALETTE.wing} opacity="0.45" /></>;
  if (shape.id === "leg_line") return <><rect x="25" y="31" width="16" height="2" fill={PIXEL_PALETTE.insectDark} /><rect x="45" y="31" width="16" height="2" fill={PIXEL_PALETTE.insectDark} /></>;
  if (shape.id === "antenna_line") return <><rect x="36" y="22" width="12" height="2" fill={PIXEL_PALETTE.insectDark} /><rect x="50" y="20" width="3" height="3" fill={PIXEL_PALETTE.insectDark} /></>;
  if (shape.id === "body_cluster") return <><rect x="36" y="25" width="14" height="14" fill={PIXEL_PALETTE.insect} /><rect x="45" y="27" width="4" height="4" fill={PIXEL_PALETTE.highlight} /></>;
  if (shape.id === "head_block") return <rect x="34" y="20" width="20" height="20" fill={PIXEL_PALETTE.skin} />;
  if (shape.id === "cloth_panel") return <><rect x="32" y="18" width="24" height="30" fill={PIXEL_PALETTE.cloth} /><rect x="50" y="23" width="4" height="16" fill={PIXEL_PALETTE.clothLight} /></>;
  if (shape.id === "arm_strip") return <><rect x="28" y="18" width="5" height="28" fill={PIXEL_PALETTE.clothDark} /><rect x="54" y="18" width="5" height="28" fill={PIXEL_PALETTE.clothDark} /></>;
  return <><rect x="34" y="16" width="6" height="32" fill={PIXEL_PALETTE.clothDark} /><rect x="48" y="16" width="6" height="32" fill={PIXEL_PALETTE.clothDark} /></>;
}

const styles = {
  panel: { display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: "18px", padding: "20px", color: "#eef7ef" },
  sidebar: { position: "sticky", top: "20px", alignSelf: "start", padding: "18px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "20px", background: "rgba(8, 18, 15, 0.64)" },
  previewColumn: { display: "grid", gap: "18px" },
  card: { padding: "18px", border: "1px solid rgba(191, 225, 196, 0.18)", borderRadius: "20px", background: "rgba(8, 18, 15, 0.58)" },
  cardHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" },
  panelTitle: { margin: "0 0 12px", fontSize: "18px" },
  sectionTitle: { margin: "0 0 10px", color: "#d8ead8", fontSize: "14px" },
  description: { margin: "0", color: "#c7d8ca", fontSize: "13px", lineHeight: 1.6 },
  blockSection: { marginTop: "18px" },
  buttonGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" },
  button: { padding: "10px 12px", border: "1px solid rgba(191, 225, 196, 0.22)", borderRadius: "12px", color: "#d8ead8", background: "rgba(255, 255, 255, 0.06)", fontWeight: 800, cursor: "pointer" },
  activeButton: { padding: "10px 12px", border: 0, borderRadius: "12px", color: "#102119", background: "#9fceaa", fontWeight: 900, cursor: "pointer" },
  primitiveGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(122px, 1fr))", gap: "12px", marginTop: "14px" },
  shapeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: "12px", marginTop: "14px" },
  visualCard: { display: "grid", gap: "7px", justifyItems: "center", padding: "12px", border: "1px solid rgba(191, 225, 196, 0.12)", borderRadius: "14px", background: "rgba(255, 255, 255, 0.045)" },
  sampleStage: { display: "grid", placeItems: "center", width: "86px", height: "58px", borderRadius: "10px", background: "#17231f" },
  shapeSvg: { borderRadius: "10px", background: "#17231f" },
  visualName: { color: "#eef7ef", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11px", textAlign: "center", overflowWrap: "anywhere" },
  visualCaption: { color: "#9fceaa", fontSize: "11px" },
  previewShell: { display: "grid", placeItems: "center", minHeight: "260px", borderRadius: "18px", background: "rgba(255, 255, 255, 0.04)" },
  previewImage: { width: "220px", height: "220px", imageRendering: "pixelated", borderRadius: "16px" },
  passBadge: { padding: "8px 10px", borderRadius: "999px", color: "#122218", background: "#9fceaa", fontSize: "12px", fontWeight: 900 },
  failBadge: { padding: "8px 10px", borderRadius: "999px", color: "#fff3f0", background: "#9a4b3f", fontSize: "12px", fontWeight: 900 },
  debugGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", margin: 0 },
  debugRow: { padding: "10px", borderRadius: "12px", background: "rgba(255, 255, 255, 0.055)", overflow: "hidden" },
  debugLabel: { color: "#9fceaa", fontSize: "11px", fontWeight: 900, marginBottom: "4px" },
  debugValue: { margin: 0, color: "#eef7ef", fontSize: "12px", lineHeight: 1.45, overflowWrap: "anywhere" },
  messageList: { margin: 0, paddingLeft: "18px", color: "#d8ead8", lineHeight: 1.7 },
} satisfies Record<string, CSSProperties>;
