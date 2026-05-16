/**
 * 当前文件负责正式世界体验页的内联样式。
 */

import type { CSSProperties } from "react"

export const WORLD_EXPERIENCE_STYLES = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    color: "#f4f0e8",
    background:
      "radial-gradient(circle at 22% 10%, rgba(113, 176, 149, 0.24), transparent 32%), radial-gradient(circle at 82% 18%, rgba(127, 154, 203, 0.18), transparent 28%), #111720",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  shell: {
    width: "min(1180px, 100%)",
    margin: "0 auto",
  },
  hero: {
    display: "grid",
    gap: "12px",
    marginBottom: "22px",
  },
  eyebrow: {
    margin: 0,
    color: "#9fd3b3",
    fontSize: "13px",
    fontWeight: 760,
  },
  title: {
    margin: 0,
    fontSize: "44px",
    lineHeight: 1.05,
    letterSpacing: 0,
  },
  subtitle: {
    margin: 0,
    maxWidth: "680px",
    color: "#c8d5d8",
    fontSize: "17px",
    lineHeight: 1.7,
  },
  status: {
    display: "inline-flex",
    width: "fit-content",
    border: "1px solid rgba(166, 220, 185, 0.34)",
    borderRadius: "999px",
    padding: "8px 13px",
    color: "#d8ffe4",
    background: "rgba(46, 103, 73, 0.28)",
    fontSize: "13px",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  fullWidth: {
    gridColumn: "1 / -1",
  },
  card: {
    border: "1px solid rgba(224, 218, 199, 0.16)",
    borderRadius: "24px",
    padding: "20px",
    background: "rgba(23, 31, 42, 0.76)",
    boxShadow: "0 22px 70px rgba(0, 0, 0, 0.28)",
  },
  narrativeCard: {
    border: "1px solid rgba(178, 226, 192, 0.28)",
    borderRadius: "28px",
    padding: "26px",
    background:
      "linear-gradient(135deg, rgba(54, 91, 75, 0.66), rgba(27, 38, 55, 0.78))",
  },
  cardTitle: {
    margin: "0 0 12px",
    color: "#fff8ea",
    fontSize: "18px",
    fontWeight: 760,
    letterSpacing: 0,
  },
  body: {
    margin: 0,
    color: "#cfd9dc",
    fontSize: "14px",
    lineHeight: 1.75,
  },
  narrative: {
    margin: 0,
    color: "#fff8ea",
    fontSize: "22px",
    lineHeight: 1.72,
  },
  smallLabel: {
    margin: "0 0 6px",
    color: "#9fb0b9",
    fontSize: "12px",
  },
  strong: {
    margin: "0 0 12px",
    color: "#fff8ea",
    fontSize: "15px",
    fontWeight: 740,
    lineHeight: 1.55,
  },
  meterList: {
    display: "grid",
    gap: "13px",
  },
  meterRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "6px",
    color: "#edf4ef",
    fontSize: "13px",
  },
  track: {
    height: "9px",
    overflow: "hidden",
    borderRadius: "999px",
    background: "rgba(216, 228, 225, 0.14)",
  },
  fill: {
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #a5d6a7, #90caf9)",
  },
  zoneGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
  },
  zoneCard: {
    minHeight: "132px",
    border: "1px solid rgba(224, 218, 199, 0.14)",
    borderRadius: "18px",
    padding: "14px",
    background: "rgba(255, 255, 255, 0.035)",
  },
  badge: {
    display: "inline-flex",
    borderRadius: "999px",
    padding: "4px 9px",
    color: "#162018",
    background: "#c8e6c9",
    fontSize: "12px",
    fontWeight: 780,
  },
  timeline: {
    display: "grid",
    gap: "10px",
  },
  timelineItem: {
    display: "grid",
    gridTemplateColumns: "32px 1fr",
    gap: "12px",
    alignItems: "start",
    padding: "12px",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.035)",
  },
  stepDot: {
    display: "grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 820,
  },
  eventList: {
    display: "grid",
    gap: "10px",
  },
  event: {
    borderLeft: "3px solid #a5d6a7",
    borderRadius: "12px",
    padding: "11px 12px",
    background: "rgba(255, 255, 255, 0.035)",
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  button: {
    border: "1px solid rgba(166, 198, 231, 0.32)",
    borderRadius: "999px",
    padding: "10px 14px",
    color: "#eff7ff",
    background: "rgba(80, 118, 171, 0.3)",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 720,
  },
  resetButton: {
    border: "1px solid rgba(240, 174, 174, 0.34)",
    background: "rgba(132, 66, 77, 0.3)",
  },
} satisfies Record<string, CSSProperties>
