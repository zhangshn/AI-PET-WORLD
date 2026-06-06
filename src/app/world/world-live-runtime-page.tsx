import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import {
  buildWorldVisualPainterDecision,
  readLatestWorldVisualApprovedFrameRecord,
} from "@/world/world-visual-painter"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()

  if (!runtimeView.isPersisted) {
    return (
      <main style={emptyWorldStyles.page}>
        <section style={emptyWorldStyles.panel}>
          <div style={emptyWorldStyles.brand}>AI-PET-WORLD</div>
          <h1 style={emptyWorldStyles.title}>
            World not created
            <span style={emptyWorldStyles.titleSub}>世界尚未创建</span>
          </h1>
          <p style={emptyWorldStyles.body}>
            Create a formal world first. This screen will not generate a default
            runtime or rewrite world facts.
          </p>
          <p style={emptyWorldStyles.body}>
            请先创建正式世界。本页面不会自动生成默认世界，也不会改写世界事实。
          </p>
          <a href="/create-world" style={emptyWorldStyles.link}>
            Create world / 创建世界
          </a>
        </section>
      </main>
    )
  }

  const painterDecision = await buildWorldVisualPainterDecision({
    saveRecord: runtimeView.saveRecord,
  })
  const approvedFrameReadResult = await readLatestWorldVisualApprovedFrameRecord({
    ownerId: runtimeView.saveRecord.ownerId,
    worldId: runtimeView.saveRecord.worldId,
  })
  const approvedFrame = approvedFrameReadResult.record?.approvedFrame ?? null

  if (approvedFrame?.canShowToPlayer) {
    return (
      <main style={runtimeWorldStyles.page}>
        <div style={runtimeWorldStyles.stage}>
          <div style={runtimeWorldStyles.hud}>
            <span>AI-PET-WORLD</span>
            <span>Tick {painterDecision.factManifest.tick}</span>
          </div>
          <div
            aria-label="已审核通过的世界画面"
            style={runtimeWorldStyles.frame}
          >
            {/* AI image providers are not fixed yet, so this cannot use next/image domains. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="已审核通过的 AI 世界画面"
              src={approvedFrame.imageUrl}
              style={runtimeWorldStyles.approvedImage}
            />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={blockedWorldStyles.page}>
      <section style={blockedWorldStyles.panel}>
        <div style={blockedWorldStyles.brand}>AI-PET-WORLD</div>
        <div style={blockedWorldStyles.tick}>Tick {painterDecision.factManifest.tick}</div>
        <h1 style={blockedWorldStyles.title}>
          世界视觉导演尚未就绪
          <span style={blockedWorldStyles.titleSub}>WorldVisualPainter not ready</span>
        </h1>
        <p style={blockedWorldStyles.body}>{painterDecision.reason.zh}</p>
        <p style={blockedWorldStyles.body}>{painterDecision.reason.en}</p>
        <div style={blockedWorldStyles.metaGrid}>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>MVP Target / MVP 目标</span>
            <span>{painterDecision.mvpTargetPolicy.title.zh}</span>
            <span>
              明亮、治愈、精细、俯视像素风；先做静态世界画面。
            </span>
          </div>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>Scene / 场景</span>
            <span>{painterDecision.sceneIntent.title.en}</span>
            <span>{painterDecision.sceneIntent.title.zh}</span>
          </div>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>Current stage / 当前阶段</span>
            <span>{painterDecision.currentStage}</span>
          </div>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>Display gate / 展示闸门</span>
            <span>未生成 AI 位图候选图并通过审核前禁止展示</span>
            <span>Blocked until an AI bitmap candidate passes review and becomes ApprovedFrame</span>
          </div>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>Fact audit / 事实审计</span>
            <span>
              {painterDecision.factManifestAudit.ok
                ? "事实清单可用于后续 Painter 链路"
                : "事实清单存在 warning，继续阻断展示"}
            </span>
            <span>
              主事实 {painterDecision.factManifest.primaryFacts.length} 个，
              支撑事实 {painterDecision.factManifest.supportingFacts.length} 个，
              环境事实 {painterDecision.factManifest.ambientFacts.length} 个
            </span>
          </div>
        </div>
        <p style={blockedWorldStyles.note}>
          {painterDecision.reviewReport.reason.zh}
          <br />
          {painterDecision.reviewReport.reason.en}
        </p>
      </section>
    </main>
  )
}

const emptyWorldStyles = {
  page: {
    alignItems: "center",
    background:
      "radial-gradient(circle at 50% 22%, #21362e 0, #14231e 48%, #09110f 100%)",
    color: "#d8ead8",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: 24,
  },
  panel: {
    background: "rgba(10, 20, 17, 0.38)",
    border: "1px solid rgba(143, 190, 159, 0.22)",
    maxWidth: 520,
    padding: 28,
  },
  brand: {
    color: "rgba(216, 234, 216, 0.68)",
    fontSize: 13,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    margin: "0 0 12px",
  },
  titleSub: {
    display: "block",
    fontSize: 20,
    marginTop: 8,
  },
  body: {
    lineHeight: 1.8,
    margin: "0 0 20px",
  },
  link: {
    background: "#c8df8f",
    color: "#142014",
    display: "inline-block",
    fontWeight: 700,
    padding: "12px 16px",
    textDecoration: "none",
  },
} as const

const runtimeWorldStyles = {
  page: {
    alignItems: "center",
    background:
      "radial-gradient(circle at 50% 18%, #10251d 0, #07120f 62%, #030807 100%)",
    color: "#d8ead8",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    overflow: "hidden",
    padding: 18,
  },
  stage: {
    aspectRatio: "4 / 3",
    background: "#0a1712",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42)",
    maxHeight: "calc(100vh - 36px)",
    maxWidth: "calc(100vw - 36px)",
    position: "relative",
    width: "min(1280px, calc((100vh - 36px) * 4 / 3), calc(100vw - 36px))",
  },
  hud: {
    alignItems: "center",
    color: "rgba(235, 248, 218, 0.78)",
    display: "flex",
    fontSize: 12,
    justifyContent: "space-between",
    left: 14,
    letterSpacing: "0.08em",
    pointerEvents: "none",
    position: "absolute",
    right: 14,
    textTransform: "uppercase",
    top: 12,
    zIndex: 2,
  },
  frame: {
    height: "100%",
    imageRendering: "pixelated",
    overflow: "hidden",
    width: "100%",
  },
  approvedImage: {
    display: "block",
    height: "100%",
    imageRendering: "pixelated",
    objectFit: "cover",
    width: "100%",
  },
} as const

const blockedWorldStyles = {
  page: {
    alignItems: "center",
    background:
      "radial-gradient(circle at 50% 22%, #182b24 0, #0d1815 54%, #060c0a 100%)",
    color: "#d8ead8",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: 24,
  },
  panel: {
    background: "rgba(8, 16, 14, 0.72)",
    border: "1px solid rgba(216, 234, 216, 0.14)",
    maxWidth: 720,
    padding: 28,
  },
  brand: {
    color: "rgba(216, 234, 216, 0.68)",
    fontSize: 13,
    letterSpacing: "0.08em",
    marginBottom: 12,
  },
  tick: {
    color: "#c8df8f",
    fontSize: 12,
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    margin: "0 0 12px",
  },
  titleSub: {
    color: "rgba(216, 234, 216, 0.78)",
    display: "block",
    fontSize: 20,
    marginTop: 8,
  },
  body: {
    color: "rgba(216, 234, 216, 0.62)",
    lineHeight: 1.8,
    margin: "0 0 12px",
  },
  metaGrid: {
    borderTop: "1px solid rgba(216, 234, 216, 0.12)",
    display: "grid",
    gap: 12,
    marginTop: 22,
    paddingTop: 18,
  },
  metaItem: {
    color: "rgba(216, 234, 216, 0.72)",
    display: "grid",
    gap: 4,
    fontSize: 13,
  },
  metaLabel: {
    color: "#c8df8f",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  note: {
    color: "rgba(216, 234, 216, 0.55)",
    lineHeight: 1.8,
    margin: "18px 0 0",
  },
} as const
