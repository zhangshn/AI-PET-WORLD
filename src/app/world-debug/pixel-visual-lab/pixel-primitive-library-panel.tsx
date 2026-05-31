// 该组件用于在视觉 Debug 实验室中测试像素原型库。

"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";

import {
  PIXEL_OBJECT_KINDS,
  buildPixelObjectRecipe,
  getPixelSemanticStructure,
  listPixelPrimitiveDefinitions,
  listPixelShapeDefinitions,
  renderPixelObjectToDataUri,
  type PixelObjectKind,
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

        <section style={styles.blockSection}>
          <h3 style={styles.sectionTitle}>基础像素块</h3>
          <div style={styles.pillGrid}>
            {primitives.map((primitive) => (
              <span key={primitive.kind} style={styles.pill}>{primitive.kind}</span>
            ))}
          </div>
        </section>

        <section style={styles.blockSection}>
          <h3 style={styles.sectionTitle}>基础像素形状</h3>
          <div style={styles.pillGrid}>
            {shapes.slice(0, 12).map((shape) => (
              <span key={shape.id} style={styles.pill}>{shape.id}</span>
            ))}
          </div>
        </section>
      </aside>

      <section style={styles.previewColumn}>
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

function DebugRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.debugRow}>
      <dt style={styles.debugLabel}>{label}</dt>
      <dd style={styles.debugValue}>{value}</dd>
    </div>
  );
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
  pillGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  pill: { padding: "6px 8px", borderRadius: "999px", color: "#d8ead8", background: "rgba(255, 255, 255, 0.075)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "11px" },
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
