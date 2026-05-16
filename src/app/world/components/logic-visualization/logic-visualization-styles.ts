/**
 * 当前文件负责逻辑可视化界面的内联样式。
 */

import type { CSSProperties } from "react"

export const LOGIC_VISUALIZATION_STYLES = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    color: "#e8f1ff",
    background:
      "radial-gradient(circle at top left, rgba(72, 118, 171, 0.22), transparent 34%), #0b111b",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "22px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 760,
    letterSpacing: 0,
  },
  subtitle: {
    margin: "8px 0 0",
    maxWidth: "760px",
    color: "#9fb0c8",
    fontSize: "14px",
    lineHeight: 1.65,
  },
  statusPill: {
    border: "1px solid rgba(115, 213, 171, 0.42)",
    borderRadius: "999px",
    padding: "8px 12px",
    color: "#a9f3ce",
    background: "rgba(27, 88, 63, 0.28)",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  column: {
    display: "grid",
    gap: "16px",
  },
  card: {
    border: "1px solid rgba(123, 151, 184, 0.22)",
    borderRadius: "18px",
    padding: "18px",
    background: "rgba(15, 24, 38, 0.82)",
    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.26)",
  },
  cardTitle: {
    margin: "0 0 14px",
    color: "#f3f8ff",
    fontSize: "16px",
    fontWeight: 720,
    letterSpacing: 0,
  },
  sectionHint: {
    margin: "0 0 14px",
    color: "#8fa2bd",
    fontSize: "13px",
    lineHeight: 1.55,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  metric: {
    border: "1px solid rgba(122, 151, 184, 0.18)",
    borderRadius: "12px",
    padding: "12px",
    background: "rgba(255, 255, 255, 0.035)",
  },
  metricLabel: {
    margin: "0 0 6px",
    color: "#8ea1bb",
    fontSize: "12px",
  },
  metricValue: {
    margin: 0,
    color: "#f6fbff",
    fontSize: "18px",
    fontWeight: 720,
  },
  timeline: {
    display: "grid",
    gap: "10px",
  },
  timelineItem: {
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: "12px",
    alignItems: "start",
    padding: "10px",
    borderRadius: "14px",
    border: "1px solid rgba(128, 153, 190, 0.18)",
    background: "rgba(255, 255, 255, 0.025)",
  },
  timelineDot: {
    display: "grid",
    width: "28px",
    height: "28px",
    placeItems: "center",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 800,
  },
  nodeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  node: {
    minHeight: "100px",
    border: "1px solid rgba(130, 158, 194, 0.18)",
    borderRadius: "16px",
    padding: "12px",
    background: "rgba(255, 255, 255, 0.03)",
  },
  edgeList: {
    display: "grid",
    gap: "8px",
    marginTop: "14px",
  },
  edge: {
    color: "#a9b9cf",
    fontSize: "13px",
  },
  logList: {
    display: "grid",
    gap: "10px",
    maxHeight: "360px",
    overflow: "auto",
  },
  logItem: {
    borderLeft: "3px solid #6f9df2",
    padding: "10px 10px 10px 12px",
    borderRadius: "10px",
    background: "rgba(255, 255, 255, 0.035)",
  },
  bodyText: {
    margin: 0,
    color: "#aebed2",
    fontSize: "13px",
    lineHeight: 1.55,
  },
  strongText: {
    margin: "0 0 6px",
    color: "#f3f8ff",
    fontSize: "14px",
    fontWeight: 720,
  },
  progressTrack: {
    height: "10px",
    overflow: "hidden",
    borderRadius: "999px",
    background: "rgba(119, 143, 173, 0.2)",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #68d391, #63b3ed)",
  },
  buttonRow: {
    display: "grid",
    gap: "10px",
  },
  button: {
    border: "1px solid rgba(132, 172, 226, 0.34)",
    borderRadius: "12px",
    padding: "11px 12px",
    color: "#ecf6ff",
    background: "rgba(71, 116, 184, 0.28)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 700,
  },
  dangerButton: {
    border: "1px solid rgba(245, 141, 141, 0.32)",
    background: "rgba(138, 52, 69, 0.26)",
  },
  meterList: {
    display: "grid",
    gap: "12px",
  },
  meterLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "6px",
    color: "#cfdbec",
    fontSize: "13px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    padding: "4px 8px",
    color: "#0e1726",
    background: "#9ae6b4",
    fontSize: "12px",
    fontWeight: 800,
  },
} satisfies Record<string, CSSProperties>
