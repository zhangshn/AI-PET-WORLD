import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import {
  buildWorldVisualFactManifest,
  buildWorldVisualPainterDecision,
  readLatestWorldVisualApprovedFrameRecord,
} from "@/world/world-visual-painter"
import type { WorldVisualApprovedFrame } from "@/world/world-visual-painter"

type ApprovedFrameReadStatus = "found" | "empty" | "invalid" | "failed"

type RuntimeBoundApprovedFrame = WorldVisualApprovedFrame & {
  worldId?: unknown
  tick?: unknown
}

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
  const factManifest = buildWorldVisualFactManifest({
    saveRecord: runtimeView.saveRecord,
  })
  const approvedFrameReadResult = await readLatestWorldVisualApprovedFrameRecord({
    ownerId: runtimeView.saveRecord.ownerId,
    worldId: runtimeView.saveRecord.worldId,
    currentTick: runtimeView.saveRecord.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
  })
  const approvedFrameRecord = approvedFrameReadResult.record
  const approvedFrame = approvedFrameRecord?.approvedFrame ?? null
  const approvedFrameBlock = buildApprovedFrameBlockView({
    status: approvedFrameReadResult.status,
    path: approvedFrameReadResult.path,
    warnings: approvedFrameReadResult.warnings,
    tags: approvedFrameReadResult.tags,
  })
  const currentRuntimeGate = buildCurrentRuntimeGate({
    approvedFrame,
    recordWorldId: approvedFrameRecord?.worldId ?? null,
    recordTick: approvedFrameRecord?.tick ?? null,
    recordSourceFactIds: approvedFrameRecord?.sourceFactIds ?? [],
    recordCanShowToPlayer: approvedFrameRecord?.canShowToPlayer ?? false,
    currentWorldId: runtimeView.saveRecord.worldId,
    currentTick: runtimeView.saveRecord.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
  })

  if (currentRuntimeGate.canRuntimeRender && approvedFrameRecord && approvedFrame) {
    return (
      <main style={runtimeWorldStyles.page}>
        <div style={runtimeWorldStyles.stage}>
          <div style={runtimeWorldStyles.hud}>
            <span>AI-PET-WORLD</span>
            <span>Tick {painterDecision.factManifest.tick}</span>
            <span>ApprovedFrame</span>
          </div>
          <div
            aria-label="已审核通过且匹配当前世界 tick 的世界画面"
            style={runtimeWorldStyles.frame}
          >
            {/* ApprovedFrame imageUrl only renders after the VJ-0 current-runtime gate passes. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="已审核通过的 AI 世界画面"
              src={approvedFrame.imageUrl}
              style={runtimeWorldStyles.approvedImage}
            />
          </div>
          <div style={runtimeWorldStyles.provenance}>
            <span>Review {approvedFrame.reviewScore}</span>
            <span>Candidate {approvedFrameRecord.sourceAiImageCandidateId}</span>
            <span>Condition {approvedFrameRecord.sourceGenerationConditionId}</span>
            <span>Image {approvedFrame.sourceImageSha256.slice(0, 12)}</span>
            <span>{approvedFrame.sourceImageContentType}</span>
            <span>{approvedFrame.sourceImageByteLength} bytes</span>
            <span>Frame world matched</span>
            <span>Frame tick matched</span>
            <span>Facts matched</span>
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
          {approvedFrameBlock.titleZh}
          <span style={blockedWorldStyles.titleSub}>{approvedFrameBlock.titleEn}</span>
        </h1>
        <p style={blockedWorldStyles.body}>{approvedFrameBlock.messageZh}</p>
        <p style={blockedWorldStyles.body}>{approvedFrameBlock.messageEn}</p>
        <div style={blockedWorldStyles.metaGrid}>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>MVP Target / MVP 目标</span>
            <span>{painterDecision.mvpTargetPolicy.title.zh}</span>
            <span>明亮、治愈、精细、俯视像素风；先做静态世界画面。</span>
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
            <span style={blockedWorldStyles.metaLabel}>ApprovedFrame / 审核帧</span>
            <span>读取状态：{approvedFrameReadResult.status}</span>
            <span>页面状态：{approvedFrameBlock.apiState}</span>
            <span>VJ-0 阻断：{approvedFrameBlock.vj0Blocked ? "是" : "否"}</span>
            <span>{approvedFrameBlock.displayRuleZh}</span>
          </div>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>Current gate / 当前世界闸门</span>
            <span>record worldId 匹配：{currentRuntimeGate.currentWorldMatched ? "是" : "否"}</span>
            <span>record tick 匹配：{currentRuntimeGate.currentTickMatched ? "是" : "否"}</span>
            <span>frame worldId 匹配：{currentRuntimeGate.currentFrameWorldMatched ? "是" : "否"}</span>
            <span>frame tick 匹配：{currentRuntimeGate.currentFrameTickMatched ? "是" : "否"}</span>
            <span>sourceFactIds 匹配：{currentRuntimeGate.currentSourceFactsMatched ? "是" : "否"}</span>
            <span>frame sourceFactIds 匹配：{currentRuntimeGate.currentFrameSourceFactsMatched ? "是" : "否"}</span>
            <span>当前事实数量：{factManifest.sourceFactIds.length}</span>
          </div>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>Read audit / 读取审计</span>
            <span>路径：{approvedFrameBlock.path}</span>
            <span>
              warnings：
              {approvedFrameBlock.warnings.length > 0
                ? approvedFrameBlock.warnings.join(" / ")
                : "无"}
            </span>
            <span>
              tags：
              {approvedFrameBlock.tags.length > 0
                ? approvedFrameBlock.tags.join(" / ")
                : "无"}
            </span>
          </div>
          <div style={blockedWorldStyles.metaItem}>
            <span style={blockedWorldStyles.metaLabel}>Display gate / 展示闸门</span>
            <span>未生成 AI 位图候选图并通过审核前禁止展示</span>
            <span>流程：generate → hidden candidate → judge → ApprovedFrame → /world</span>
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

function buildApprovedFrameBlockView(input: {
  status: ApprovedFrameReadStatus
  path: string
  warnings: string[]
  tags: string[]
}) {
  if (input.status === "invalid") {
    return {
      apiState: "approved_frame_blocked_by_vj_0_read_gate",
      titleZh: "世界画面被 VJ-0 阻断",
      titleEn: "ApprovedFrame blocked by VJ-0",
      messageZh:
        "已读取到 ApprovedFrameRecord，但它没有通过 VJ-0 读取闸门或当前 tick/sourceFactIds 校验。/world 不会展示旧图或坏图。",
      messageEn:
        "An ApprovedFrameRecord was found, but it failed the VJ-0 read gate or current tick/sourceFactIds check. /world will not display stale or invalid imagery.",
      displayRuleZh:
        "invalid 状态下只能显示阻断说明，不能渲染任何 ApprovedFrame 图片。",
      vj0Blocked: true,
      path: input.path,
      warnings: input.warnings,
      tags: input.tags,
    }
  }

  if (input.status === "failed") {
    return {
      apiState: "approved_frame_read_failed",
      titleZh: "世界画面读取失败",
      titleEn: "ApprovedFrame read failed",
      messageZh:
        "ApprovedFrameRecord 读取失败。为避免展示不可信画面，/world 继续阻断。",
      messageEn:
        "ApprovedFrameRecord could not be read. /world remains blocked to avoid displaying untrusted imagery.",
      displayRuleZh: "读取失败时只能显示阻断说明，不能回退展示旧图。",
      vj0Blocked: true,
      path: input.path,
      warnings: input.warnings,
      tags: input.tags,
    }
  }

  if (input.status === "found") {
    return {
      apiState: "approved_frame_found_but_runtime_gate_blocked",
      titleZh: "世界画面尚未通过展示闸门",
      titleEn: "ApprovedFrame blocked by Runtime Render gate",
      messageZh:
        "ApprovedFrameRecord 已存在，但 Runtime Render 必需字段或当前世界 tick/sourceFactIds 未全部通过。/world 不展示图片。",
      messageEn:
        "An ApprovedFrameRecord exists, but required Runtime Render fields or current world tick/sourceFactIds did not all pass. /world will not display the image.",
      displayRuleZh:
        "found 但未通过 Runtime Render gate 时，仍然只能显示阻断说明。",
      vj0Blocked: true,
      path: input.path,
      warnings: input.warnings,
      tags: input.tags,
    }
  }

  return {
    apiState: "approved_frame_empty",
    titleZh: "世界视觉导演尚未就绪",
    titleEn: "WorldVisualPainter not ready",
    messageZh: "还没有 ApprovedFrame。需要先生成候选图并通过 VisualJudge。",
    messageEn:
      "No ApprovedFrame exists yet. Generate a candidate and pass VisualJudge first.",
    displayRuleZh: "没有 ApprovedFrame 时，/world 必须继续阻断。",
    vj0Blocked: false,
    path: input.path,
    warnings: input.warnings,
    tags: input.tags,
  }
}

function buildCurrentRuntimeGate(input: {
  approvedFrame: WorldVisualApprovedFrame | null
  recordWorldId: string | null
  recordTick: number | null
  recordSourceFactIds: string[]
  recordCanShowToPlayer: boolean
  currentWorldId: string
  currentTick: number
  currentSourceFactIds: string[]
}) {
  const runtimeFrame = input.approvedFrame as RuntimeBoundApprovedFrame | null
  const hardFieldsValid = input.approvedFrame
    ? canRenderApprovedFrame(input.approvedFrame)
    : false
  const currentWorldMatched = input.recordWorldId === input.currentWorldId
  const currentTickMatched = input.recordTick === input.currentTick
  const currentFrameWorldMatched = runtimeFrame?.worldId === input.currentWorldId
  const currentFrameTickMatched = runtimeFrame?.tick === input.currentTick
  const currentSourceFactsMatched = sameStringSet(
    input.recordSourceFactIds,
    input.currentSourceFactIds
  )
  const currentFrameSourceFactsMatched = input.approvedFrame
    ? sameStringSet(input.approvedFrame.sourceFactIds, input.currentSourceFactIds)
    : false
  const canRuntimeRender =
    input.recordCanShowToPlayer === true &&
    input.approvedFrame?.canShowToPlayer === true &&
    hardFieldsValid &&
    currentWorldMatched &&
    currentTickMatched &&
    currentFrameWorldMatched &&
    currentFrameTickMatched &&
    currentSourceFactsMatched &&
    currentFrameSourceFactsMatched

  return {
    hardFieldsValid,
    currentWorldMatched,
    currentTickMatched,
    currentFrameWorldMatched,
    currentFrameTickMatched,
    currentSourceFactsMatched,
    currentFrameSourceFactsMatched,
    canRuntimeRender,
  }
}

function canRenderApprovedFrame(approvedFrame: WorldVisualApprovedFrame): boolean {
  return (
    approvedFrame.canShowToPlayer === true &&
    typeof approvedFrame.sourceImageSha256 === "string" &&
    approvedFrame.sourceImageSha256.length === 64 &&
    typeof approvedFrame.sourceImageByteLength === "number" &&
    approvedFrame.sourceImageByteLength > 0 &&
    typeof approvedFrame.sourceImageContentType === "string" &&
    isApprovedContentType(approvedFrame.sourceImageContentType) &&
    approvedFrame.sourceImagePayloadQualityPassed === true
  )
}

function isApprovedContentType(contentType: string): boolean {
  return (
    contentType === "image/png" ||
    contentType === "image/webp" ||
    contentType === "image/jpeg"
  )
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false

  const rightSet = new Set(right)
  return left.every((value) => rightSet.has(value))
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
    gap: 12,
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
  provenance: {
    alignItems: "center",
    background: "rgba(0, 0, 0, 0.36)",
    bottom: 12,
    color: "rgba(235, 248, 218, 0.72)",
    display: "flex",
    fontSize: 11,
    gap: 12,
    left: 12,
    maxWidth: "calc(100% - 24px)",
    overflow: "hidden",
    padding: "8px 10px",
    pointerEvents: "none",
    position: "absolute",
    right: 12,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    zIndex: 2,
  },
} as const

const blockedWorldStyles = {
  page: {
    alignItems: "center",
    background:
      "linear-gradient(180deg, #10251d 0%, #08120f 58%, #050908 100%)",
    color: "#d8ead8",
    display: "flex",
    justifyContent: "center",
    minHeight: "100vh",
    padding: 24,
  },
  panel: {
    background: "rgba(8, 17, 14, 0.76)",
    border: "1px solid rgba(151, 194, 156, 0.18)",
    maxWidth: 920,
    padding: 28,
  },
  brand: {
    color: "rgba(216, 234, 216, 0.68)",
    fontSize: 13,
    letterSpacing: "0.12em",
    marginBottom: 10,
  },
  tick: {
    color: "rgba(216, 234, 216, 0.58)",
    fontSize: 13,
    marginBottom: 18,
  },
  title: {
    fontSize: 34,
    margin: "0 0 16px",
  },
  titleSub: {
    color: "rgba(216, 234, 216, 0.66)",
    display: "block",
    fontSize: 18,
    marginTop: 8,
  },
  body: {
    lineHeight: 1.8,
    margin: "0 0 14px",
  },
  metaGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    marginTop: 24,
  },
  metaItem: {
    background: "rgba(255, 255, 255, 0.045)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 14,
  },
  metaLabel: {
    color: "rgba(216, 234, 216, 0.52)",
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  note: {
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    color: "rgba(216, 234, 216, 0.74)",
    lineHeight: 1.8,
    margin: "24px 0 0",
    paddingTop: 18,
  },
} as const
