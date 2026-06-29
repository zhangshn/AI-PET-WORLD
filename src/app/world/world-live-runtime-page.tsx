import type { CSSProperties, ReactNode } from "react"
import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import {
  buildWorldGameRuntimeFrame,
  buildWorldRuntimeFrameGate,
  buildWorldVisualFactManifest,
  buildWorldVisualPainterDecision,
  readLatestWorldVisualApprovedFrameRecord,
} from "@/world/world-visual-painter"
import type { WorldGameRuntimeFrame } from "@/world/world-visual-painter"

type ApprovedFrameReadStatus = "found" | "empty" | "invalid" | "failed"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()

  if (!runtimeView.isPersisted) {
    return (
      <main style={emptyWorldStyles.page}>
        <section style={emptyWorldStyles.panel}>
          <div style={emptyWorldStyles.brand}>AI-PET-WORLD</div>
          <h1 style={emptyWorldStyles.title}>世界尚未创建</h1>
          <p style={emptyWorldStyles.body}>
            请先创建正式世界。本页面不会自动生成默认世界，也不会改写世界事实。
          </p>
          <a href="/create-world" style={emptyWorldStyles.link}>
            创建世界
          </a>
        </section>
      </main>
    )
  }

  const saveRecord = runtimeView.saveRecord
  const painterDecision = await buildWorldVisualPainterDecision({ saveRecord })
  const factManifest = buildWorldVisualFactManifest({ saveRecord })
  const approvedFrameReadResult = await readLatestWorldVisualApprovedFrameRecord({
    ownerId: saveRecord.ownerId,
    worldId: saveRecord.worldId,
    currentTick: saveRecord.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
  })
  const approvedFrameRecord = approvedFrameReadResult.record
  const approvedFrame = approvedFrameRecord?.approvedFrame ?? null
  const runtimeFrameBuild = buildWorldGameRuntimeFrame({
    ownerId: saveRecord.ownerId,
    currentWorldId: saveRecord.worldId,
    currentTick: saveRecord.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
    approvedFrame,
    reviewReport: approvedFrameRecord?.reviewReport ?? null,
    recordWorldId: approvedFrameRecord?.worldId ?? null,
    recordTick: approvedFrameRecord?.tick ?? null,
    recordSourceFactIds: approvedFrameRecord?.sourceFactIds ?? [],
  })
  const runtimeGate = buildWorldRuntimeFrameGate({
    approvedFrame,
    reviewReport: approvedFrameRecord?.reviewReport ?? null,
    recordWorldId: approvedFrameRecord?.worldId ?? null,
    recordTick: approvedFrameRecord?.tick ?? null,
    recordSourceFactIds: approvedFrameRecord?.sourceFactIds ?? [],
    recordCanShowToPlayer: approvedFrameRecord?.canShowToPlayer ?? false,
    currentWorldId: saveRecord.worldId,
    currentTick: saveRecord.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
    runtimeFrameReady: runtimeFrameBuild.runtimeFrameReady,
    runtimeFrameId: runtimeFrameBuild.runtimeFrame?.frameId ?? null,
    runtimeFrameBlockedReasons: runtimeFrameBuild.blockedReasons,
  })

  if (runtimeGate.canRuntimeRender && runtimeFrameBuild.runtimeFrame) {
    return <WorldGameRuntimeFramePage runtimeFrame={runtimeFrameBuild.runtimeFrame} />
  }

  const blockView = buildApprovedFrameBlockView({
    status: approvedFrameReadResult.status,
    path: approvedFrameReadResult.path,
    warnings: approvedFrameReadResult.warnings,
    tags: approvedFrameReadResult.tags,
  })

  return (
    <main style={blockedWorldStyles.page}>
      <section style={blockedWorldStyles.panel}>
        <div style={blockedWorldStyles.brand}>AI-PET-WORLD</div>
        <div style={blockedWorldStyles.tick}>Tick {saveRecord.tick}</div>
        <h1 style={blockedWorldStyles.title}>{blockView.title}</h1>
        <p style={blockedWorldStyles.body}>{blockView.message}</p>
        <p style={blockedWorldStyles.body}>
          正式规则：世界事实先生成，AI Painter 只负责画面表达；VisualJudge、
          ApprovedFrame 和 RuntimeFrame 没有全部通过，就不展示主世界画面。
        </p>

        <div style={blockedWorldStyles.metaGrid}>
          <GateItem title="当前阶段">
            <span>{painterDecision.currentStage}</span>
            <span>{painterDecision.mvpTargetPolicy.title.zh}</span>
          </GateItem>
          <GateItem title="ApprovedFrame 读取">
            <span>状态：{approvedFrameReadResult.status}</span>
            <span>路径：{blockView.path}</span>
            <span>
              警告：
              {blockView.warnings.length ? blockView.warnings.join(" / ") : "无"}
            </span>
          </GateItem>
          <GateItem title="RuntimeFrame 闸门">
            <GateLine label="基础字段" value={runtimeGate.hardFieldsValid} />
            <GateLine
              label="正式世界边界"
              value={runtimeGate.gameWorldDisplayBoundaryPassed}
            />
            <GateLine
              label="审核报告"
              value={runtimeGate.reviewReportGameWorldPassed}
            />
            <GateLine
              label="项目最终确认"
              value={runtimeGate.ownerFinalWorldApprovalPassed}
            />
            <GateLine
              label="游戏界面合成层"
              value={runtimeGate.runtimeGameInterfaceReady}
            />
            <span>RuntimeFrame 状态：{runtimeFrameBuild.status}</span>
            <GateLine
              label="worldId 匹配"
              value={
                runtimeGate.currentWorldMatched &&
                runtimeGate.currentFrameWorldMatched
              }
            />
            <GateLine
              label="tick 匹配"
              value={
                runtimeGate.currentTickMatched &&
                runtimeGate.currentFrameTickMatched
              }
            />
            <GateLine
              label="sourceFactIds 匹配"
              value={
                runtimeGate.currentSourceFactsMatched &&
                runtimeGate.currentFrameSourceFactsMatched
              }
            />
          </GateItem>
          <GateItem title="世界事实清单">
            <span>sourceFactIds：{factManifest.sourceFactIds.length}</span>
            <span>主事实：{painterDecision.factManifest.primaryFacts.length}</span>
            <span>
              支撑事实：{painterDecision.factManifest.supportingFacts.length}
            </span>
            <span>环境事实：{painterDecision.factManifest.ambientFacts.length}</span>
          </GateItem>
        </div>
      </section>
    </main>
  )
}

function WorldGameRuntimeFramePage(props: { runtimeFrame: WorldGameRuntimeFrame }) {
  const visualLayer = props.runtimeFrame.visualLayers[0] ?? null

  return (
    <main style={runtimeFrameStyles.page}>
      <section
        aria-label="AI-PET-WORLD game runtime frame"
        style={runtimeFrameStyles.stage}
      >
        {visualLayer ? (
          <div
            aria-hidden="true"
            style={{
              ...runtimeFrameStyles.visualLayer,
              backgroundImage: `url("${visualLayer.imageUrl}")`,
            }}
          />
        ) : null}
        <div aria-hidden="true" style={runtimeFrameStyles.interactionLayer} />
        <div style={runtimeFrameStyles.hud}>
          <span>AI-PET-WORLD</span>
          <span>Tick {props.runtimeFrame.tick}</span>
          <span>RuntimeFrame</span>
        </div>
        <div style={runtimeFrameStyles.runtimeAudit}>
          RuntimeFrame {props.runtimeFrame.frameId}
        </div>
      </section>
    </main>
  )
}

function GateItem(props: { title: string; children: ReactNode }) {
  return (
    <div style={blockedWorldStyles.metaItem}>
      <span style={blockedWorldStyles.metaLabel}>{props.title}</span>
      {props.children}
    </div>
  )
}

function GateLine(props: { label: string; value: boolean }) {
  return (
    <span>
      {props.label}：{props.value ? "通过" : "未通过"}
    </span>
  )
}

function buildApprovedFrameBlockView(input: {
  status: ApprovedFrameReadStatus
  path: string
  warnings: string[]
  tags: string[]
}) {
  if (input.status === "invalid") {
    return {
      title: "世界画面被 VJ-0 阻断",
      message:
        "已读取 ApprovedFrameRecord，但它没有通过当前 tick、worldId 或 sourceFactIds 校验，所以不能展示。",
      path: input.path,
      warnings: input.warnings,
      tags: input.tags,
    }
  }

  if (input.status === "failed") {
    return {
      title: "世界画面读取失败",
      message:
        "ApprovedFrameRecord 读取失败。为避免展示不可信画面，/world 保持隐藏状态。",
      path: input.path,
      warnings: input.warnings,
      tags: input.tags,
    }
  }

  if (input.status === "found") {
    return {
      title: "世界画面尚未通过正式展示闸门",
      message:
        "ApprovedFrameRecord 已存在，但 /world 需要完整游戏 RuntimeFrame。单张 ApprovedFrame 图片只能作为视觉层数据，不能直接展示为玩家主世界。",
      path: input.path,
      warnings: input.warnings,
      tags: input.tags,
    }
  }

  return {
    apiState: "approved_frame_empty",
    title: "AI Painter 尚未生成可展示画面",
    message:
      "还没有正式游戏世界 ApprovedFrame。需要先生成隐藏 Candidate，并通过 VisualJudge。",
    path: input.path,
    warnings: input.warnings,
    tags: input.tags,
  }
}

const emptyWorldStyles: Record<string, CSSProperties> = {
  page: {
    alignItems: "center",
    background: "radial-gradient(circle at 50% 22%, #21362e 0, #14231e 48%, #09110f 100%)",
    color: "#d8ead8",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: 24,
  },
  panel: {
    background: "rgba(10, 20, 17, 0.45)",
    border: "1px solid rgba(143, 190, 159, 0.22)",
    maxWidth: 520,
    padding: 28,
  },
  brand: { color: "rgba(216, 234, 216, 0.68)", fontSize: 13, marginBottom: 12 },
  title: { fontSize: 34, margin: "0 0 12px" },
  body: { lineHeight: 1.8, margin: "0 0 20px" },
  link: {
    background: "#c8df8f",
    color: "#142014",
    display: "inline-block",
    fontWeight: 700,
    padding: "12px 16px",
    textDecoration: "none",
  },
}

const runtimeFrameStyles: Record<string, CSSProperties> = {
  page: {
    alignItems: "center",
    background: "radial-gradient(circle at 50% 18%, #10251d 0, #07120f 62%, #030807 100%)",
    color: "#d8ead8",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    overflow: "hidden",
    padding: 18,
  },
  stage: {
    aspectRatio: "4 / 3",
    background: "#08120f",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42)",
    maxHeight: "calc(100vh - 36px)",
    maxWidth: "calc(100vw - 36px)",
    overflow: "hidden",
    position: "relative",
    width: "min(1280px, calc((100vh - 36px) * 4 / 3), calc(100vw - 36px))",
  },
  visualLayer: {
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    height: "100%",
    imageRendering: "pixelated",
    inset: 0,
    position: "absolute",
    width: "100%",
  },
  interactionLayer: {
    border: "1px solid rgba(216, 234, 216, 0.18)",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
  },
  hud: {
    alignItems: "center",
    color: "rgba(235, 248, 218, 0.78)",
    display: "flex",
    fontSize: 12,
    gap: 12,
    justifyContent: "space-between",
    left: 16,
    letterSpacing: "0.08em",
    position: "absolute",
    right: 16,
    textTransform: "uppercase",
    top: 12,
    zIndex: 2,
  },
  runtimeAudit: {
    bottom: 12,
    color: "rgba(235, 248, 218, 0.68)",
    fontSize: 11,
    left: 16,
    position: "absolute",
    zIndex: 2,
  },
}

const blockedWorldStyles: Record<string, CSSProperties> = {
  page: {
    background: "radial-gradient(circle at 50% 20%, #1a2d26 0, #0d1915 54%, #050908 100%)",
    color: "#d8ead8",
    minHeight: "100vh",
    padding: 24,
  },
  panel: {
    background: "rgba(8, 17, 14, 0.52)",
    border: "1px solid rgba(143, 190, 159, 0.2)",
    margin: "0 auto",
    maxWidth: 980,
    padding: 28,
  },
  brand: { color: "rgba(216, 234, 216, 0.62)", fontSize: 13, letterSpacing: "0.08em" },
  tick: { color: "rgba(216, 234, 216, 0.78)", fontSize: 14, marginTop: 10 },
  title: { fontSize: 32, lineHeight: 1.2, margin: "14px 0 12px" },
  body: { lineHeight: 1.8, margin: "0 0 8px" },
  metaGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    marginTop: 22,
  },
  metaItem: {
    background: "rgba(255, 255, 255, 0.045)",
    border: "1px solid rgba(216, 234, 216, 0.1)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 14,
  },
  metaLabel: { color: "rgba(216, 234, 216, 0.55)", fontSize: 12, textTransform: "uppercase" },
}
