"use client"

/**
 * ======================================================
 * AI-PET-WORLD
 * Personality Test Page
 * ======================================================
 *
 * 【文件职责】
 * 这是“人格核心测试页”，不是正式产品页。
 *
 * 它负责：
 * 1. 手动输入出生时间
 * 2. 调用人格核心 gateway
 * 3. 生成独立测试命盘
 * 4. 以紫微斗数开发视角展示内部结构
 *
 * ------------------------------------------------------
 * 【重要边界】
 * 本页允许显示紫微斗数术语，仅用于：
 * - 开发调试
 * - 算法校验
 * - 盘面可视化
 *
 * 正式产品页不能直接复用这里的紫微展示文案。
 *
 * ======================================================
 */

import { useMemo, useState } from "react"
import { buildPersonalityProfile } from "../../ai/personality-core/gateway"
import type { SectorName } from "../../ai/personality-core/schema"
import {
  DEV_SECTOR_LABELS,
  DEV_TRAIT_LABELS,
  getDevStarLabel
} from "./devLabels"

export default function PersonalityTestPage() {
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(4)
  const [day, setDay] = useState(17)
  const [hour, setHour] = useState(9)

  /**
   * ======================================================
   * 通过输入时间实时生成独立测试命盘
   * ======================================================
   */
  const result = useMemo(() => {
    return buildPersonalityProfile({
      year,
      month,
      day,
      hour
    })
  }, [year, month, day, hour])

  const { pattern, traits, debug, summaries, corePersonality } = result

  /**
   * ======================================================
   * 紫微盘固定布局（标准 12 宫测试布局）
   *
   * 注意：
   * - 这里只是测试页布局
   * - 目标是更接近传统 12 宫阅读习惯
   * ======================================================
   */
  const layout: (SectorName | null)[][] = [
    ["parents", "fortune", "property", "career"],
    ["health", null, null, "friends"],
    ["wealth", null, null, "travel"],
    ["children", "spouse", "siblings", "life"]
  ]

  /**
   * ======================================================
   * 渲染单个宫位
   * ======================================================
   */
  function renderCell(sector: SectorName | null) {
    if (!sector) {
      return (
        <div
          style={{
            border: "1px dashed #ccc",
            minHeight: 120,
            borderRadius: 8,
            background: "#fafafa"
          }}
        />
      )
    }

    const stars = pattern.sectors[sector] || []
    const isPrimary = sector === pattern.primarySector
    const isSupport = debug?.supportSectors?.includes(sector) ?? false

    return (
      <div
        style={{
          border: isPrimary
            ? "2px solid #ff4d4f"
            : isSupport
            ? "2px dashed #1677ff"
            : "1px solid #ccc",
          borderRadius: 8,
          padding: 10,
          fontSize: 12,
          minHeight: 120,
          background: isPrimary ? "#fff1f0" : "#fff"
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: 8 }}>
          {DEV_SECTOR_LABELS[sector]}
          {isPrimary ? " ⭐" : ""}
        </div>

        <div style={{ lineHeight: 1.6 }}>
          {stars.length > 0
            ? stars
                .map((starId) => `${starId}（${getDevStarLabel(starId)}）`)
                .join(" / ")
            : "空宫"}
        </div>
      </div>
    )
  }

  /**
   * ======================================================
   * 输入框样式
   * ======================================================
   */
  const inputStyle: React.CSSProperties = {
    width: 90,
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: 6,
    marginRight: 8
  }

  /**
   * ======================================================
   * 页面
   * ======================================================
   */
  return (
    <div
      style={{
        padding: 20,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}
    >
      <h2 style={{ marginBottom: 16 }}>🧠 人格核心测试命盘（开发版）</h2>

      {/* ================= 输入区域 ================= */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center"
        }}
      >
        <label>
          年：
          <input
            style={inputStyle}
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>

        <label>
          月：
          <input
            style={inputStyle}
            type="number"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </label>

        <label>
          日：
          <input
            style={inputStyle}
            type="number"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
          />
        </label>

        <label>
          时：
          <input
            style={inputStyle}
            type="number"
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          />
        </label>
      </div>

      {/* ================= 命盘区域 ================= */}
      <h3 style={{ marginBottom: 12 }}>📊 十二宫结构</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8
        }}
      >
        {layout.flat().map((sector, index) => (
          <div key={index}>{renderCell(sector)}</div>
        ))}
      </div>

      {/* ================= 中央人格信息 ================= */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          border: "2px solid #333",
          borderRadius: 10,
          background: "#fafafa"
        }}
      >
        <h3 style={{ marginTop: 0 }}>🧬 核心人格信息</h3>

        <div style={{ marginBottom: 8 }}>
          核心宫位：
          <strong>
            {pattern.primarySector}（{DEV_SECTOR_LABELS[pattern.primarySector]}）
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          核心星曜：
          <strong>
            {debug?.primaryStars?.length
              ? debug.primaryStars
                  .map(
                    (starId) => `${starId}（${getDevStarLabel(starId)}）`
                  )
                  .join(" + ")
              : "无"}
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          命宫组合：
          <strong>
            {debug?.hitPairs?.length
              ? debug.hitPairs
                  .map(
                    (pair) =>
                      `${pair.pairId}（${pair.starIds
                        .map((starId) => getDevStarLabel(starId))
                        .join(" + ")}）`
                  )
                  .join(" / ")
              : "无"}
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          三方四正组合：
          <strong>
            {debug?.supportPairs?.length
              ? debug.supportPairs
                  .map(
                    (pair) =>
                      `${pair.pairId}（${pair.starIds
                        .map((starId) => getDevStarLabel(starId))
                        .join(" + ")}）`
                  )
                  .join(" / ")
              : "无"}
          </strong>
        </div>

        <div style={{ marginBottom: 8 }}>
          联动宫位：
          <strong>
            {debug?.supportSectors?.length
              ? debug.supportSectors
                  .map(
                    (sector) => `${sector}（${DEV_SECTOR_LABELS[sector]}）`
                  )
                  .join(" / ")
              : "无"}
          </strong>
        </div>

        <div>
          联动星曜：
          <strong>
            {debug?.supportStars?.length
              ? debug.supportStars
                  .map(
                    (starId) => `${starId}（${getDevStarLabel(starId)}）`
                  )
                  .join(" / ")
              : "无"}
          </strong>
        </div>
      </div>

      {/* ================= 核心5维人格 ================= */}
      <div style={{ marginTop: 20 }}>
        <h3>🌟 核心 5 维人格</h3>

        {Object.entries(corePersonality).map(([key, value]) => (
          <div key={key} style={{ marginBottom: 6 }}>
            {key}: {value}
          </div>
        ))}
      </div>

      {/* ================= 行为层 traits ================= */}
      <div style={{ marginTop: 20 }}>
        <h3>📈 行为层人格参数</h3>

        {Object.entries(traits).map(([key, value]) => (
          <div key={key} style={{ marginBottom: 6 }}>
            {key}（{DEV_TRAIT_LABELS[key] || "未定义"}）: {value}
          </div>
        ))}
      </div>

      {/* ================= 摘要 ================= */}
      <div style={{ marginTop: 20 }}>
        <h3>📝 人格摘要</h3>

        {summaries.length > 0 ? (
          <ul>
            {summaries.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <div>暂无摘要</div>
        )}
      </div>

      {/* ================= Debug ================= */}
      <div style={{ marginTop: 20 }}>
        <h3>🧾 Debug</h3>
        <pre
          style={{
            background: "#f6f6f6",
            padding: 12,
            borderRadius: 8,
            overflowX: "auto"
          }}
        >
          {JSON.stringify(debug, null, 2)}
        </pre>
      </div>
    </div>
  )
}