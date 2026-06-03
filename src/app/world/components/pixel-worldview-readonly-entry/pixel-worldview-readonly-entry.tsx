import type { WorldViewModel } from "@/world/world-view-model"
import {
  buildPixelWorldPixelBufferFrame,
  buildPixelWorldRenderPlan,
  buildPixelWorldRendererFrame,
  mapPixelWorldViewModelFromSnapshot,
  mapWorldViewModelToPixelWorldSourceSnapshot,
} from "@/world/pixel-worldview"
import type {
  VisualCorrectionPlan,
  VisualDisplayGateDecision,
  VisualJudgeReport,
} from "@/world/visual-judge"
import {
  buildVisualDisplayGateDecision,
  buildVisualFactManifestFromWorldViewModel,
} from "@/world/visual-judge"
import { buildVisualGenerationPlan } from "@/world/visual-generation"
import {
  VISUAL_STYLE_SAFETY_POLICY,
  listVisualReferenceGuidelines,
} from "@/world/visual-reference"

import { PixiPixelWorldRendererClient } from "../pixi-pixel-world-renderer/pixi-pixel-world-renderer.client"

export function PixelWorldViewReadonlyEntry(input: {
  worldViewModel: WorldViewModel
}) {
  const source = mapWorldViewModelToPixelWorldSourceSnapshot(input.worldViewModel)
  const pixelModel = mapPixelWorldViewModelFromSnapshot(source)
  const visualGenerationPlan = buildVisualGenerationPlan({
    worldViewModel: input.worldViewModel,
  })
  const visualFactManifest = buildVisualFactManifestFromWorldViewModel(
    input.worldViewModel
  )
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
  const displayGate = buildVisualDisplayGateDecision({
    visualGenerationPlan,
    renderPlan,
    pixelBufferFrame: bufferResult.buffer,
    visualFactManifest,
  })
  const playerVisibleBuffer =
    displayGate.correctedPixelBufferFrame ?? bufferResult.buffer

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

        {displayGate.canShowToPlayer ? (
          <PixiPixelWorldRendererClient buffer={playerVisibleBuffer} />
        ) : (
          <VisualDisplayBlockedPanel gate={displayGate} />
        )}

        <VisualJudgePanel gate={displayGate} />

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

function VisualDisplayBlockedPanel(input: {
  gate: VisualDisplayGateDecision
}) {
  return (
    <section style={styles.blockedPanel}>
      <div style={styles.blockedEyebrow}>Visual Display Gate</div>
      <h2 style={styles.blockedTitle}>画面暂不展示给玩家</h2>
      <p style={styles.blockedBody}>
        当前画面没有通过视觉判断。系统只会生成视觉表达层面的修正计划，
        不会改写 runtime 中的世界事实。
      </p>
      <div style={styles.blockedMeta}>
        <span>状态：{input.gate.status}</span>
        <span>剩余失败：{input.gate.review.remainingFailCount}</span>
        <span>阻塞原因：{input.gate.review.blockReasons.length}</span>
      </div>
    </section>
  )
}

function VisualJudgePanel(input: {
  gate: VisualDisplayGateDecision
}) {
  const report = input.gate.report
  const correctionPlan = input.gate.correctionPlan
  const topFindings = report.findings.slice(0, 4)
  const topActions = correctionPlan.actions.slice(0, 3)
  const referenceGuidelines = listVisualReferenceGuidelines().slice(0, 4)

  return (
    <aside style={styles.visualJudgePanel}>
      <div style={styles.visualJudgeHeader}>
        <div>
          <div style={styles.visualJudgeEyebrow}>Visual Judge</div>
          <h2 style={styles.visualJudgeTitle}>视觉审查</h2>
        </div>
        <span style={badgeStyleForSeverity(input.gate.review.finalSeverity)}>
          {input.gate.review.finalSeverity.toUpperCase()}
        </span>
      </div>

      <section style={styles.displayGateSection}>
        <div style={styles.displayGateHeader}>
          <span>展示闸门</span>
          <strong>{displayGateLabel(input.gate)}</strong>
        </div>
        <p style={styles.displayGateText}>{input.gate.reason}</p>
      </section>

      <div style={styles.visualJudgeScoreRow}>
        <strong style={styles.visualJudgeScore}>{report.score}</strong>
        <span style={styles.visualJudgeScoreLabel}>分 / 不改世界事实</span>
      </div>

      <p style={styles.visualJudgeSummary}>
        {report.ok
          ? "原始画面通过视觉审查，可以作为本 tick 的玩家可见画面。"
          : `原始画面发现 ${report.findings.length} 个视觉问题，已进入视觉修正与复审闭环。`}
      </p>

      <VisualGateReviewSection gate={input.gate} />
      <VisualSafetySection guidelines={referenceGuidelines} />
      <VisualCorrectionSection correctionPlan={correctionPlan} actions={topActions} />
      <VisualFindingSection findings={topFindings} />
    </aside>
  )
}

function VisualGateReviewSection(input: {
  gate: VisualDisplayGateDecision
}) {
  const review = input.gate.review

  return (
    <section style={styles.gateReviewSection}>
      <div style={styles.gateReviewHeader}>
        <span>复审闭环</span>
        <strong>{review.finalSeverity}</strong>
      </div>
      <div style={styles.gateReviewGrid}>
        <span>原始：{review.originalSeverity}</span>
        <span>剩余问题：{review.remainingFindingCount}</span>
        <span>剩余失败：{review.remainingFailCount}</span>
        <span>已解决：{review.resolvedFindingCount}</span>
        <span>视觉生成 cell：{review.generatedVisualOnlyCellCount}</span>
      </div>
      <div style={styles.gateReviewTags}>
        {review.phases.map((phase) => (
          <span key={phase} style={styles.gateReviewTag}>
            {phase}
          </span>
        ))}
      </div>
    </section>
  )
}

function VisualSafetySection(input: {
  guidelines: ReturnType<typeof listVisualReferenceGuidelines>
}) {
  return (
    <section style={styles.visualSafetySection}>
      <div style={styles.visualSafetyHeader}>视觉参考安全</div>
      <p style={styles.visualSafetyText}>
        允许参考真实世界的抽象视觉原则；禁止复制参考图、模仿名艺术家、
        复制 IP 或重建具体截图。
      </p>
      <div style={styles.visualSafetyTags}>
        {VISUAL_STYLE_SAFETY_POLICY.requiredOutputTags.map((tag) => (
          <span key={tag} style={styles.visualSafetyTag}>
            {tag}
          </span>
        ))}
      </div>
      <ul style={styles.referenceGuidelineList}>
        {input.guidelines.map((guideline) => (
          <li key={guideline.id} style={styles.referenceGuidelineItem}>
            {guideline.category}: {guideline.allowedUse}
          </li>
        ))}
      </ul>
    </section>
  )
}

function VisualCorrectionSection(input: {
  correctionPlan: VisualCorrectionPlan
  actions: VisualCorrectionPlan["actions"]
}) {
  return (
    <section style={styles.visualCorrectionSection}>
      <div style={styles.visualCorrectionHeader}>
        <span>Visual Correction Plan</span>
        <strong>{input.correctionPlan.actionCount}</strong>
      </div>
      <p style={styles.visualCorrectionBoundary}>
        Visual-only plan. Runtime facts stay unchanged.
      </p>
      {input.actions.length > 0 ? (
        <ol style={styles.visualCorrectionList}>
          {input.actions.map((action) => (
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
  )
}

function VisualFindingSection(input: {
  findings: VisualJudgeReport["findings"]
}) {
  if (input.findings.length === 0) {
    return <div style={styles.visualJudgeEmpty}>没有基础规则失败项。</div>
  }

  return (
    <ul style={styles.visualJudgeList}>
      {input.findings.map((finding) => (
        <li key={finding.id} style={styles.visualJudgeFinding}>
          <span style={findingSeverityStyle(finding.severity)}>
            {finding.severity}
          </span>
          <span style={styles.visualJudgeFindingText}>{finding.message}</span>
        </li>
      ))}
    </ul>
  )
}

function displayGateLabel(gate: VisualDisplayGateDecision): string {
  if (gate.status === "allow_display") return "允许展示给玩家"
  if (gate.status === "requires_visual_correction") return "需要视觉修正"
  return "禁止直接展示"
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
  blockedPanel: {
    alignContent: "center",
    background: "rgba(10, 20, 17, 0.78)",
    border: "1px solid rgba(202, 104, 82, 0.42)",
    display: "grid",
    gap: 10,
    minHeight: 480,
    padding: 24,
  },
  blockedEyebrow: {
    color: "#ffb39f",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  blockedTitle: {
    fontSize: 28,
    margin: 0,
  },
  blockedBody: {
    color: "rgba(216, 234, 216, 0.76)",
    lineHeight: 1.8,
    maxWidth: 620,
    margin: 0,
  },
  blockedMeta: {
    color: "rgba(216, 234, 216, 0.66)",
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    fontSize: 12,
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
  gateReviewSection: {
    background: "rgba(200, 223, 143, 0.07)",
    border: "1px solid rgba(200, 223, 143, 0.2)",
    display: "grid",
    gap: 8,
    padding: 9,
  },
  gateReviewHeader: {
    alignItems: "center",
    color: "#c8df8f",
    display: "flex",
    fontSize: 11,
    fontWeight: 900,
    justifyContent: "space-between",
    textTransform: "uppercase",
  },
  gateReviewGrid: {
    color: "rgba(216, 234, 216, 0.72)",
    display: "grid",
    fontSize: 11,
    gap: 5,
    gridTemplateColumns: "1fr 1fr",
  },
  gateReviewTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
  },
  gateReviewTag: {
    background: "rgba(159, 206, 170, 0.1)",
    border: "1px solid rgba(159, 206, 170, 0.16)",
    color: "rgba(216, 234, 216, 0.78)",
    fontSize: 10,
    padding: "3px 5px",
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
