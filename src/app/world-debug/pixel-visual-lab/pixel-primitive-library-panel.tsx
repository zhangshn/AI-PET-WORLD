// 该组件用于在视觉 Debug 实验室中测试自然世界像素原型库。

"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";

import {
  PIXEL_PALETTE,
  buildNaturalObjectRecipe,
  getPixelSemanticStructure,
  listPixelPrimitiveDefinitions,
  listPixelShapeDefinitions,
  renderPixelObjectToDataUri,
  type NaturalPixelObjectKind,
  type PixelPrimitiveDefinition,
  type PixelShapeDefinition,
} from "@/world/pixel-primitives";

const NATURAL_PIXEL_OBJECT_KINDS = ["tree", "bush", "flower", "mushroom", "grass_tile", "stone", "insect"] as const satisfies readonly NaturalPixelObjectKind[];

const NATURAL_PIXEL_SHAPE_IDS = new Set([
  "leaf_row",
  "leaf_cluster",
  "trunk_strip",
  "shadow_patch",
  "highlight_chip",
  "grass_chip",
  "soil_chip",
  "worn_strip",
  "pressed_mark",
  "stone_cluster",
  "wing_chip",
  "leg_line",
  "antenna_line",
  "body_cluster",
]);

const OBJECT_LABELS: Record<NaturalPixelObjectKind, string> = {
  bush: "灌木",
  flower: "花",
  mushroom: "蘑菇",
  tree: "树木",
  grass_tile: "草地",
  stone: "石头",
  insect: "昆虫",
};

export default function PixelPrimitiveLibraryPanel() {
  const [selectedKind, setSelectedKind] = useState<NaturalPixelObjectKind>("tree");
  const primitives = useMemo(() => listPixelPrimitiveDefinitions(), []);
  const shapes = useMemo(
    () => listPixelShapeDefinitions().filter((shape) => NATURAL_PIXEL_SHAPE_IDS.has(shape.id)),
    []
  );
  const result = useMemo(() => buildNaturalObjectRecipe(selectedKind), [selectedKind]);
  const semantic = getPixelSemanticStructure(selectedKind);
  const svgDataUri = useMemo(() => renderPixelObjectToDataUri(result), [result]);

  return (
    <section style={styles.panel}>
      <aside style={styles.sidebar}>
        <h2 style={styles.panelTitle}>自然像素原型库</h2>
        <p style={styles.description}>
          本阶段只测试自然世界的基础板块：树、草地、石头、昆虫信号。人物和管家模型放到后期单独设计，不进入当前 v1 原型库。
        </p>

        <section style={styles.blockSection}>
          <h3 style={styles.sectionTitle}>自然物生成</h3>
          <div style={styles.buttonGrid}>
            {NATURAL_PIXEL_OBJECT_KINDS.map((kind) => (
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

        <section style={styles.blockSection}>
          <h3 style={styles.sectionTitle}>当前边界</h3>
          <p style={styles.description}>
            不拼图片，不读取 runtime，不写入世界事实，不推进 Tick。这里先把自然世界的基础笔刷和原始图形打磨清楚。
          </p>
        </section>
      </aside>

      <section style={styles.previewColumn}>
        <article style={styles.card}>
          <h2 style={styles.panelTitle}>基础像素笔刷 / 原始方框</h2>
          <p style={styles.description}>
            这里不是最终物体，也不是小图标素材；它们是算法可调用的底层笔刷样本。单个方框很简单，但必须先看清楚它们在不同尺寸、方向和透明度下的表现。
          </p>
          <div style={styles.primitiveGrid}>
            {primitives.map((primitive) => (
              <PrimitiveCard key={primitive.kind} primitive={primitive} />
            ))}
          </div>
        </article>

        <article style={styles.card}>
          <h2 style={styles.panelTitle}>自然像素形状 / 原始图形</h2>
          <p style={styles.description}>
            这里展示自然世界第一阶段需要的形状：叶子行、叶团、树干条、草点、土点、磨损、石头团块、昆虫翅膀和身体。人物相关形状已暂时隐藏。
          </p>
          <div style={styles.shapeGrid}>
            {shapes.map((shape) => (
              <ShapeCard key={shape.id} shape={shape} />
            ))}
          </div>
        </article>

        <article style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.panelTitle}>自然物单体预览：{result.label}</h2>
              <p style={styles.description}>Quality Recipe：{result.recipeId}</p>
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
  return (
    <div style={styles.visualCard} data-primitive-card={primitive.kind}>
      <svg width="122" height="78" viewBox="0 0 122 78" shapeRendering="crispEdges" style={styles.shapeSvg}>
        <rect x="0" y="0" width="122" height="78" fill="#17231f" />
        {renderPrimitiveSample(primitive)}
      </svg>
      <strong style={styles.visualName}>{primitive.kind}</strong>
      <span style={styles.visualCaption}>{primitive.label}</span>
    </div>
  );
}

function ShapeCard({ shape }: { shape: PixelShapeDefinition }) {
  return (
    <div style={styles.visualCard} data-shape-card={shape.id}>
      <svg width="122" height="78" viewBox="0 0 122 78" shapeRendering="crispEdges" style={styles.shapeSvg}>
        <rect x="0" y="0" width="122" height="78" fill="#17231f" />
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

function renderPrimitiveSample(primitive: PixelPrimitiveDefinition) {
  if (primitive.kind === "square_block") {
    return <><rect x="36" y="26" width="14" height="14" fill={PIXEL_PALETTE.stone} /><rect x="54" y="26" width="14" height="14" fill={PIXEL_PALETTE.stoneDark} /><rect x="72" y="26" width="14" height="14" fill={PIXEL_PALETTE.stoneLight} /></>;
  }
  if (primitive.kind === "wide_block") {
    return <><rect x="30" y="24" width="56" height="7" fill={PIXEL_PALETTE.leaf} /><rect x="38" y="36" width="44" height="7" fill={PIXEL_PALETTE.leafDark} /></>;
  }
  if (primitive.kind === "tall_block") {
    return <><rect x="48" y="18" width="8" height="42" fill={PIXEL_PALETTE.trunkDark} /><rect x="60" y="22" width="8" height="34" fill={PIXEL_PALETTE.trunk} /><rect x="72" y="30" width="5" height="24" fill={PIXEL_PALETTE.trunkLight} /></>;
  }
  if (primitive.kind === "dot_block") {
    return <><rect x="38" y="28" width="5" height="5" fill={PIXEL_PALETTE.highlight} /><rect x="55" y="36" width="4" height="4" fill={PIXEL_PALETTE.grassLight} /><rect x="72" y="25" width="3" height="3" fill={PIXEL_PALETTE.soil} /><rect x="84" y="42" width="4" height="4" fill={PIXEL_PALETTE.leafLight} /></>;
  }
  if (primitive.kind === "line_block") {
    return <><rect x="28" y="28" width="38" height="3" fill={PIXEL_PALETTE.insectDark} /><rect x="54" y="40" width="32" height="3" fill={PIXEL_PALETTE.insectDark} opacity="0.72" /></>;
  }
  if (primitive.kind === "shadow_block") {
    return <><ellipse cx="61" cy="42" rx="36" ry="10" fill={PIXEL_PALETTE.shadow} opacity="0.42" /><ellipse cx="67" cy="39" rx="22" ry="6" fill={PIXEL_PALETTE.shadow} opacity="0.22" /></>;
  }
  if (primitive.kind === "highlight_block") {
    return <><rect x="36" y="26" width="24" height="5" fill={PIXEL_PALETTE.highlight} /><rect x="66" y="34" width="11" height="4" fill={PIXEL_PALETTE.leafLight} /><rect x="82" y="25" width="6" height="4" fill={PIXEL_PALETTE.highlight} /></>;
  }
  if (primitive.kind === "dark_block") {
    return <><rect x="34" y="30" width="46" height="7" fill={PIXEL_PALETTE.leafDark} /><rect x="48" y="42" width="30" height="6" fill={PIXEL_PALETTE.leafUnder} /></>;
  }
  if (primitive.kind === "transparent_block") {
    return <><rect x="34" y="25" width="24" height="13" fill={PIXEL_PALETTE.wing} opacity="0.42" /><rect x="64" y="25" width="24" height="13" fill={PIXEL_PALETTE.wing} opacity="0.42" /></>;
  }
  return <><rect x="34" y="27" width="4" height="4" fill={PIXEL_PALETTE.grassLight} /><rect x="52" y="39" width="3" height="3" fill={PIXEL_PALETTE.grassDark} /><rect x="70" y="30" width="3" height="3" fill={PIXEL_PALETTE.soil} /><rect x="84" y="44" width="4" height="4" fill={PIXEL_PALETTE.leafDark} /></>;
}

function renderShapeSample(shape: PixelShapeDefinition) {
  const leafColor = PIXEL_PALETTE.leaf;
  const darkLeaf = PIXEL_PALETTE.leafDark;
  const grass = PIXEL_PALETTE.grassLight;
  const stone = PIXEL_PALETTE.stone;

  if (shape.id === "leaf_row") return <rect x="28" y="36" width="66" height="7" fill={leafColor} />;
  if (shape.id === "leaf_cluster") return <><rect x="43" y="18" width="38" height="7" fill={PIXEL_PALETTE.leafLight} /><rect x="28" y="29" width="70" height="8" fill={leafColor} /><rect x="36" y="41" width="54" height="8" fill={darkLeaf} /></>;
  if (shape.id === "trunk_strip") return <><rect x="54" y="14" width="14" height="50" fill={PIXEL_PALETTE.trunkDark} /><rect x="61" y="18" width="8" height="42" fill={PIXEL_PALETTE.trunk} /><rect x="70" y="28" width="4" height="24" fill={PIXEL_PALETTE.trunkLight} /></>;
  if (shape.id === "shadow_patch") return <><ellipse cx="61" cy="44" rx="38" ry="11" fill={PIXEL_PALETTE.shadow} opacity="0.42" /><ellipse cx="67" cy="41" rx="23" ry="6" fill={PIXEL_PALETTE.shadow} opacity="0.24" /></>;
  if (shape.id === "highlight_chip") return <><rect x="42" y="30" width="22" height="5" fill={PIXEL_PALETTE.highlight} /><rect x="68" y="37" width="8" height="5" fill={PIXEL_PALETTE.highlight} /></>;
  if (shape.id === "grass_chip") return <><rect x="46" y="31" width="4" height="22" fill={grass} /><rect x="60" y="24" width="4" height="28" fill={PIXEL_PALETTE.grassDark} /><rect x="74" y="38" width="3" height="14" fill={grass} /></>;
  if (shape.id === "soil_chip") return <><rect x="36" y="36" width="10" height="5" fill={PIXEL_PALETTE.soil} /><rect x="56" y="43" width="5" height="5" fill={PIXEL_PALETTE.soilDark} /><rect x="74" y="31" width="4" height="4" fill={PIXEL_PALETTE.soil} /></>;
  if (shape.id === "worn_strip") return <rect x="30" y="37" width="64" height="9" fill={PIXEL_PALETTE.soil} opacity="0.55" />;
  if (shape.id === "pressed_mark") return <rect x="30" y="39" width="64" height="6" fill={PIXEL_PALETTE.grassDark} opacity="0.65" />;
  if (shape.id === "stone_cluster") return <><rect x="34" y="40" width="56" height="14" fill={PIXEL_PALETTE.stoneDark} /><rect x="42" y="29" width="44" height="16" fill={stone} /><rect x="50" y="32" width="23" height="5" fill={PIXEL_PALETTE.stoneLight} /></>;
  if (shape.id === "wing_chip") return <><rect x="34" y="29" width="24" height="13" fill={PIXEL_PALETTE.wing} opacity="0.45" /><rect x="64" y="29" width="24" height="13" fill={PIXEL_PALETTE.wing} opacity="0.45" /></>;
  if (shape.id === "leg_line") return <><rect x="35" y="43" width="22" height="3" fill={PIXEL_PALETTE.insectDark} /><rect x="65" y="43" width="22" height="3" fill={PIXEL_PALETTE.insectDark} /></>;
  if (shape.id === "antenna_line") return <><rect x="50" y="27" width="18" height="2" fill={PIXEL_PALETTE.insectDark} /><rect x="70" y="24" width="4" height="4" fill={PIXEL_PALETTE.insectDark} /></>;
  if (shape.id === "body_cluster") return <><rect x="52" y="33" width="18" height="16" fill={PIXEL_PALETTE.insect} /><rect x="64" y="35" width="5" height="5" fill={PIXEL_PALETTE.highlight} /></>;
  return <rect x="48" y="30" width="24" height="10" fill={PIXEL_PALETTE.leaf} />;
}

const styles = {
  panel: { display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: "18px", padding: "20px", color: "#eef7ef" },
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
  primitiveGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginTop: "14px" },
  shapeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginTop: "14px" },
  visualCard: { display: "grid", gap: "7px", justifyItems: "center", padding: "12px", border: "1px solid rgba(191, 225, 196, 0.12)", borderRadius: "14px", background: "rgba(255, 255, 255, 0.045)" },
  shapeSvg: { borderRadius: "10px", background: "#17231f", width: "122px", height: "78px" },
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
