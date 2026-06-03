import type { WorldViewModel } from "@/world/world-view-model"
import {
  buildPixelWorldPixelBufferFrame,
  buildPixelWorldRenderPlan,
  buildPixelWorldRendererFrame,
  mapPixelWorldViewModelFromSnapshot,
  mapWorldViewModelToPixelWorldSourceSnapshot,
} from "@/world/pixel-worldview"
import type { VisualCorrectionPlan, VisualJudgeReport } from "@/world/visual-judge"
import { buildVisualCorrectionPlan, judgePixelWorldVisual } from "@/world/visual-judge"
import { buildVisualGenerationPlan } from "@/world/visual-generation"
import {
  VISUAL_STYLE_SAFETY_POLICY,
  listVisualReferenceGuidelines,
} from "@/world/visual-reference"

import { PixiPixelWorldRendererClient } from "../pixi-pixel-world-renderer/pixi-pixel-world-renderer.client"

export function PixelWorldViewReadonlyEntry(input: {
  worldViewModel: WorldViewModel
}) {
  const source = mapWorldViewModelToPixelWorldSourceSnapshot(
    input.worldViewModel
  )
  const pixelModel = mapPixelWorldViewModelFromSnapshot(source)
  const visualGenerationPlan = buildVisualGenerationPlan({
    worldViewModel: input.worldViewModel,
  })
  const renderPlan = buildPixelWorldRenderPlan(pixelModel, {
    visualGenerationPlan,
  })
  const rendererResult = buildPixelWorldRendererFrame({
    plan: renderPlan,
    target: "formal_world",
  })
  const bufferResult = buildPixelWorldPixelBufferFrame({
    plan: renderPlan,
    frame: rendererResult.frame,
  })
  const visualJudgeReport = judgePixelWorldVisual({
    visualGenerationPlan,
    renderPlan,
    pixelBufferFrame: bufferResult.buffer,
  })
  const visualCorrectionPlan = buildVisualCorrectionPlan(visualJudgeReport)

  return (
    <main style={styles.page}>
      <section style={styles.worldPanel}>
        <header style={styles.topHud}>
          <div>
            <div style={styles.brand}>AI-PET-WORLD</div>
            <h1 style={styles.title}>你的自主像素世界</h1>
          </div>
          <div style={styles.tickBadge}>Tick {input.worldViewModel.tick}</div>
        </header>

        <PixiPixelWorldRendererClient buffer={bufferResult.buffer} />
        <VisualJudgePanel
          correctionPlan={visualCorrectionPlan}
          report={visualJudgeReport}
        />

        <footer style={styles.bottomHud}>
          <div style={styles.butlerHint}>
            <strong>{input.worldViewModel.butlerExplanation.title}</strong>
            <span>{input.worldViewModel.butlerExplanation.body}</span>
          </div>
          <div style={styles.pPhoneBadge}>
            <span>P-Phone</span>
            <strong>{input.worldViewModel.pPhone.unreadCount}</strong>
          </div>
        </footer>
      </section>
    </main>
  )
}

function VisualJudgePanel(input: {
  correctionPlan: VisualCorrectionPlan
  report: VisualJudgeReport
}) {
  const topFindings = input.report.findings.slice(0, 4)
  const topActions = input.correctionPlan.actions.slice(0, 3)
  const referenceGuidelines = listVisualReferenceGuidelines().slice(0, 4)
  const displayGateLabel = input.report.ok ? "允许展示给玩家" : "禁止直接展示"
  const displayGateDetail = input.report.ok
    ? "当前画面通过基础视觉审查，可以作为本 tick 的玩家可见画面。"
    : "当前画面需要先执行视觉修正计划，只修画面表达，不篡改世界事实。"

  return (
    <aside style={styles.visualJudgePanel}>
      <div style={styles.visualJudgeHeader}>
        <div>
          <div style={styles.visualJudgeEyebrow}>Visual Judge</div>
          <h2 style={styles.visualJudgeTitle}>视觉审查</h2>
        </div>
        <span style={badgeStyleForSeverity(input.report.severity)}>
          {input.report.severity.toUpperCase()}
        </span>
      </div>

      <section style={styles.displayGateSection}>
        <div style={styles.displayGateHeader}>
          <span>展示闸门</span>
          <strong>{displayGateLabel}</strong>
        </div>
        <p style={styles.displayGateText}>{displayGateDetail}</p>
      </section>

      <div style={styles.visualJudgeScoreRow}>
        <strong style={styles.visualJudgeScore}>{input.report.score}</strong>
        <span style={styles.visualJudgeScoreLabel}>分 / 不改世界事实</span>
      </div>

      <p style={styles.visualJudgeSummary}>
        {input.report.ok
          ? "当前画面通过基础视觉审查。"
          : `发现 ${input.report.findings.length} 个视觉问题，等待视觉修正计划处理。`}
      </p>

      <section style={styles.visualSafetySection}>
        <div style={styles.visualSafetyHeader}>视觉参考安全</div>
        <p style={styles.visualSafetyText}>
          允许参考真实世界的抽象视觉原则；禁止复制参考图、模仿名艺术家、复刻 IP 或重建具体截图。
        </p>
        <div style={styles.visualSafetyTags}>
          {VISUAL_STYLE_SAFETY_POLICY.requiredOutputTags.map((tag) => (
            <span key={tag} style={styles.visualSafetyTag}>
              {tag}
            </span>
          ))}
        </div>
        <ul style={styles.referenceGuidelineList}>
          {referenceGuidelines.map((guideline) => (
            <li key={guideline.id} style={styles.referenceGuidelineItem}>
              {guideline.category}: {guideline.allowedUse}
            </li>
          ))}
        </ul>
      </section>

      <section style={styles.visualCorrectionSection}>
        <div style={styles.visualCorrectionHeader}>
          <span>Visual Correction Plan</span>
          <strong>{input.correctionPlan.actionCount}</strong>
        </div>
        <p style={styles.visualCorrectionBoundary}>
          Visual-only plan. Runtime facts stay unchanged.
        </p>
        {topActions.length > 0 ? (
          <ol style={styles.visualCorrectionList}>
            {topActions.map((action) => (
              <li key={action.id} style={styles.visualCorrectionAction}>
                <strong>{action.type}</strong>
                <span>{action.reason}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div style={styles.visualCorrectionEmpty}>No visual-only actions.</div>
        )}
      </section>

      {topFindings.length > 0 ? (
        <ul style={styles.visualJudgeList}>
          {topFindings.map((finding) => (
            <li key={finding.id} style={styles.visualJudgeFinding}>
              <span style={findingSeverityStyle(finding.severity)}>
                {finding.severity}
              </span>
              <span style={styles.visualJudgeFindingText}>
                {finding.message}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div style={styles.visualJudgeEmpty}>没有基础规则失败项。</div>
      )}
    </aside>
  )
}

function badgeStyleForSeverity(severity: VisualJudgeReport["severity"]) {
  if (severity === "fail") return styles.visualJudgeFailBadge
  if (severity === "warn") return styles.visualJudgeWarnBadge

  return styles.visualJudgePassBadge
}

function findingSeverityStyle(severity: "info" | "warn" | "fail") {
  if (severity === "fail") return styles.visualJudgeFindingFail
  if (severity === "warn") return styles.visualJudgeFindingWarn

  return styles.visualJudgeFindingInfo
}

const styles = {
  page: {
    background:
      "radial-gradient(circle at 50% 20%, #22372f 0, #17231f 42%, #0f1815 100%)",
    color: "#d8ead8",
    minHeight: "100vh",
    padding: 20,
  },
  worldPanel: {
    background: "rgba(11, 20, 17, 0.72)",
    border: "1px solid rgba(143, 190, 159, 0.28)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42)",
    minHeight: "calc(100vh - 40px)",
    overflow: "hidden",
    padding: 16,
    position: "relative",
  },
  topHud: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
    pointerEvents: "none",
  },
  brand: {
    color: "rgba(216, 234, 216, 0.62)",
    fontSize: 12,
    letterSpacing: "0.16em",
  },
  title: {
    fontSize: 24,
    lineHeight: 1.2,
    margin: "3px 0 0",
  },
  tickBadge: {
    background: "rgba(20, 34, 29, 0.82)",
    border: "1px solid rgba(200, 223, 143, 0.42)",
    color: "#c8df8f",
    fontSize: 13,
    padding: "8px 10px",
  },
  bottomHud: {
    alignItems: "end",
    bottom: 24,
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    left: 24,
    pointerEvents: "none",
    position: "absolute",
    right: 24,
  },
  butlerHint: {
    background: "rgba(15, 26, 22, 0.78)",
    border: "1px solid rgba(143, 190, 159, 0.26)",
    display: "grid",
    gap: 4,
    lineHeight: 1.55,
    maxWidth: 520,
    padding: "10px 12px",
  },
  pPhoneBadge: {
    alignItems: "center",
    background: "rgba(20, 34, 29, 0.84)",
    border: "1px solid rgba(143, 190, 159, 0.32)",
    display: "flex",
    gap: 10,
    padding: "10px 12px",
  },
  visualJudgePanel: {
    background: "rgba(10, 20, 17, 0.9)",
    border: "1px solid rgba(200, 223, 143, 0.28)",
    boxShadow: "0 16px 50px rgba(0, 0, 0, 0.32)",
    color: "#d8ead8",
    display: "grid",
    gap: 10,
    maxHeight: "calc(100vh - 128px)",
    maxWidth: 380,
    overflow: "auto",
    padding: 14,
    position: "absolute",
    right: 24,
    top: 86,
    zIndex: 2,
  },
  visualJudgeHeader: {
    alignItems: "start",
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
  },
  visualJudgeEyebrow: {
    color: "rgba(216, 234, 216, 0.56)",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  visualJudgeTitle: {
    fontSize: 18,
    margin: "2px 0 0",
  },
  visualJudgePassBadge: {
    background: "rgba(159, 206, 170, 0.18)",
    border: "1px solid rgba(159, 206, 170, 0.42)",
    color: "#9fceaa",
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 7px",
  },
  visualJudgeWarnBadge: {
    background: "rgba(219, 178, 93, 0.18)",
    border: "1px solid rgba(219, 178, 93, 0.42)",
    color: "#e4c37a",
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 7px",
  },
  visualJudgeFailBadge: {
    background: "rgba(202, 104, 82, 0.18)",
    border: "1px solid rgba(202, 104, 82, 0.46)",
    color: "#ffb39f",
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 7px",
  },
  displayGateSection: {
    background: "rgba(200, 223, 143, 0.07)",
    border: "1px solid rgba(200, 223, 143, 0.2)",
    display: "grid",
    gap: 6,
    padding: 9,
  },
  displayGateHeader: {
    alignItems: "center",
    color: "#c8df8f",
    display: "flex",
    fontSize: 11,
    fontWeight: 900,
    justifyContent: "space-between",
  },
  displayGateText: {
    color: "rgba(216, 234, 216, 0.76)",
    fontSize: 12,
    lineHeight: 1.5,
    margin: 0,
  },
  visualJudgeScoreRow: {
    alignItems: "baseline",
    display: "flex",
    gap: 8,
  },
  visualJudgeScore: {
    color: "#c8df8f",
    fontSize: 30,
    lineHeight: 1,
  },
  visualJudgeScoreLabel: {
    color: "rgba(216, 234, 216, 0.64)",
    fontSize: 12,
  },
  visualJudgeSummary: {
    color: "rgba(216, 234, 216, 0.76)",
    fontSize: 12,
    lineHeight: 1.55,
    margin: 0,
  },
  visualSafetySection: {
    background: "rgba(255, 255, 255, 0.035)",
    border: "1px solid rgba(143, 190, 159, 0.16)",
    display: "grid",
    gap: 7,
    padding: 9,
  },
  visualSafetyHeader: {
    color: "#c8df8f",
    fontSize: 11,
    fontWeight: 900,
  },
  visualSafetyText: {
    color: "rgba(216, 234, 216, 0.7)",
    fontSize: 11,
    lineHeight: 1.45,
    margin: 0,
  },
  visualSafetyTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
  },
  visualSafetyTag: {
    background: "rgba(159, 206, 170, 0.1)",
    border: "1px solid rgba(159, 206, 170, 0.16)",
    color: "rgba(216, 234, 216, 0.78)",
    fontSize: 10,
    padding: "3px 5px",
  },
  referenceGuidelineList: {
    display: "grid",
    gap: 4,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  referenceGuidelineItem: {
    color: "rgba(216, 234, 216, 0.58)",
    fontSize: 10,
    lineHeight: 1.35,
  },
  visualCorrectionSection: {
    background: "rgba(255, 255, 255, 0.035)",
    border: "1px solid rgba(143, 190, 159, 0.16)",
    display: "grid",
    gap: 7,
    padding: 9,
  },
  visualCorrectionHeader: {
    alignItems: "center",
    color: "#c8df8f",
    display: "flex",
    fontSize: 11,
    fontWeight: 900,
    justifyContent: "space-between",
    textTransform: "uppercase",
  },
  visualCorrectionBoundary: {
    color: "rgba(216, 234, 216, 0.68)",
    fontSize: 11,
    lineHeight: 1.45,
    margin: 0,
  },
  visualCorrectionList: {
    display: "grid",
    gap: 6,
    margin: 0,
    paddingLeft: 16,
  },
  visualCorrectionAction: {
    color: "rgba(216, 234, 216, 0.76)",
    display: "grid",
    gap: 2,
    fontSize: 11,
    lineHeight: 1.45,
  },
  visualCorrectionEmpty: {
    color: "rgba(216, 234, 216, 0.56)",
    fontSize: 11,
  },
  visualJudgeList: {
    display: "grid",
    gap: 7,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  visualJudgeFinding: {
    background: "rgba(255, 255, 255, 0.045)",
    display: "grid",
    gap: 4,
    padding: 8,
  },
  visualJudgeFindingText: {
    color: "rgba(216, 234, 216, 0.78)",
    fontSize: 11,
    lineHeight: 1.45,
  },
  visualJudgeFindingFail: {
    color: "#ffb39f",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  visualJudgeFindingWarn: {
    color: "#e4c37a",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  visualJudgeFindingInfo: {
    color: "#9fceaa",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  visualJudgeEmpty: {
    background: "rgba(159, 206, 170, 0.08)",
    color: "rgba(216, 234, 216, 0.72)",
    fontSize: 12,
    padding: 8,
  },
} as const
