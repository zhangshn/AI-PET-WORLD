import { readFile } from "node:fs/promises"
import path from "node:path"

import type { CSSProperties, ReactNode } from "react"

import { readLatestGameMapRuntimeFrameRecord } from "@/world/game-map-frame"
import type { GameMapRuntimeFrame } from "@/world/game-map-frame"
import { readWorldRuntimeForView } from "@/world/runtime/world-runtime-gateway"
import { buildWorldVisualFactManifest } from "@/world/world-visual-painter"

import { WorldRuntimeSurface } from "./world-runtime-surface"
import type {
  WorldRuntimeSurfaceInteraction,
  WorldRuntimeSurfaceMarker,
} from "./world-runtime-surface"

const WORLD_DISPLAY_REQUIRED_TAG = "composite_game_map_runtime_frame"
const WORLD_FORMAL_JUDGE_REQUIRED_TAG = "formal_game_map_visual_judge_passed"

export async function WorldLiveRuntimePage() {
  const runtimeView = await readWorldRuntimeForView()

  if (!runtimeView.isPersisted) {
    return (
      <main style={pageStyles.page}>
        <section style={pageStyles.panel}>
          <div style={pageStyles.brand}>AI-PET-WORLD</div>
          <h1 style={pageStyles.title}>世界尚未创建</h1>
          <p style={pageStyles.body}>
            请先创建正式世界。这个页面不会自动生成默认世界，也不会改写世界事实。
          </p>
          <a href="/create-world" style={pageStyles.link}>
            创建世界
          </a>
        </section>
      </main>
    )
  }

  const saveRecord = runtimeView.saveRecord
  const factManifest = buildWorldVisualFactManifest({ saveRecord })
  const runtimeFrameReadResult = await readLatestGameMapRuntimeFrameRecord({
    ownerId: saveRecord.ownerId,
    worldId: saveRecord.worldId,
    currentTick: saveRecord.tick,
    currentSourceFactIds: factManifest.sourceFactIds,
  })
  const runtimeFrame = runtimeFrameReadResult.record?.runtimeFrame ?? null

  if (
    runtimeFrameReadResult.status === "found" &&
    runtimeFrame !== null &&
    isWorldDisplayRuntimeFrame(runtimeFrame)
  ) {
    const compositeOutput = runtimeFrame.composition.compositeOutput!
    const ownerReview = await readOwnerRuntimeFrameReviewGate(runtimeFrame)

    if (!ownerReview.canShow) {
      return (
        <WorldRuntimeFrameBlockedPage
          factManifestSourceCount={factManifest.sourceFactIds.length}
          ownerId={saveRecord.ownerId}
          runtimeFrame={runtimeFrame}
          runtimeFrameReadPath={runtimeFrameReadResult.path}
          runtimeFrameReadStatus={runtimeFrameReadResult.status}
          runtimeFrameReadWarnings={ownerReview.warnings}
          tick={saveRecord.tick}
          title="世界画面被人工最终复核阻断"
          worldId={saveRecord.worldId}
        />
      )
    }

    return (
      <WorldRuntimeSurface
        imageSrc={getRuntimeFrameImageSrc(
          compositeOutput?.imageUrl ?? "",
          compositeOutput?.imageSha256 ?? ""
        )}
        runtimeFrameId={runtimeFrame.runtimeFrameId}
        worldId={runtimeFrame.worldId}
        tick={runtimeFrame.tick}
        imageWidth={runtimeFrame.visual.imageWidth}
        imageHeight={runtimeFrame.visual.imageHeight}
        layerCounts={{
          terrain: runtimeFrame.layers.terrain.length,
          objects: runtimeFrame.layers.objects.length,
          walkable: runtimeFrame.layers.walkable.length,
          collision: runtimeFrame.layers.collision.length,
          interactions: runtimeFrame.layers.interactions.length,
          stateRefs: runtimeFrame.runtimeState.stateRefs.length,
        }}
        markers={buildWorldRuntimeMarkers(runtimeFrame)}
        interactions={buildWorldRuntimeInteractions(runtimeFrame)}
      />
    )
  }

  return (
    <WorldRuntimeFrameBlockedPage
      factManifestSourceCount={factManifest.sourceFactIds.length}
      ownerId={saveRecord.ownerId}
      runtimeFrame={runtimeFrame}
      runtimeFrameReadPath={runtimeFrameReadResult.path}
      runtimeFrameReadStatus={runtimeFrameReadResult.status}
      runtimeFrameReadWarnings={runtimeFrameReadResult.warnings}
      tick={saveRecord.tick}
      title={
        runtimeFrameReadResult.status === "found"
          ? "世界画面被正式闸门阻断"
          : "游戏 RuntimeFrame 尚未就绪"
      }
      worldId={saveRecord.worldId}
    />
  )
}

function WorldRuntimeFrameBlockedPage(props: {
  factManifestSourceCount: number
  ownerId: string
  runtimeFrame: GameMapRuntimeFrame | null
  runtimeFrameReadPath: string
  runtimeFrameReadStatus: string
  runtimeFrameReadWarnings: string[]
  tick: number
  title: string
  worldId: string
}) {
  return (
    <main style={pageStyles.page}>
      <section style={pageStyles.panel}>
        <div style={pageStyles.brand}>AI-PET-WORLD</div>
        <div style={pageStyles.tick}>Tick {props.tick}</div>
        <h1 style={pageStyles.title}>{props.title}</h1>
        <p style={pageStyles.body}>
          /world 是游戏主入口，只能展示完整游戏地图 RuntimeFrame。训练图、候选图、局部图、
          单张 ApprovedFrame、单张模型输出、贴图预览都不能放到这里。
        </p>
        <p style={pageStyles.body}>
          正式链路必须是：世界事实生成地图结构，地图结构拆成可组合地图块和视觉单元，
          AI Painter 只负责视觉表达，Runtime Compositor 把通过审核的视觉单元合成为完整地图，
          最后由 Formal VisualJudge 与 RuntimeFrame 闸门放行。
        </p>
        <div style={pageStyles.metaGrid}>
          <GateItem title="RuntimeFrame 读取">
            <span>状态：{props.runtimeFrameReadStatus}</span>
            <span>路径：{props.runtimeFrameReadPath}</span>
            <span>
              警告：
              {props.runtimeFrameReadWarnings.length
                ? props.runtimeFrameReadWarnings.join(" / ")
                : "无"}
            </span>
          </GateItem>
          <GateItem title="显示闸门">
            <span>必须是完整游戏地图 RuntimeFrame</span>
            <span>必须带 {WORLD_DISPLAY_REQUIRED_TAG}</span>
            <span>必须带 {WORLD_FORMAL_JUDGE_REQUIRED_TAG}</span>
            <span>
              当前是否通过：
              {props.runtimeFrame
                ? (isWorldDisplayRuntimeFrame(props.runtimeFrame) ? "机器通过 / 等待人工" : "否")
                : "否"}
            </span>
          </GateItem>
          <GateItem title="当前世界">
            <span>worldId：{props.worldId}</span>
            <span>ownerId：{props.ownerId}</span>
            <span>sourceFactIds：{props.factManifestSourceCount}</span>
          </GateItem>
          <GateItem title="禁止进入 /world">
            <span>训练图</span>
            <span>候选图</span>
            <span>局部图或裁剪图</span>
            <span>单张 ApprovedFrame 图片</span>
            <span>结构化 fallback 预览</span>
          </GateItem>
        </div>
      </section>
    </main>
  )
}

function isWorldDisplayRuntimeFrame(runtimeFrame: GameMapRuntimeFrame): boolean {
  const compositeOutput = runtimeFrame.composition.compositeOutput

  return (
    compositeOutput !== null &&
    compositeOutput.imageUrl.length > 0 &&
    compositeOutput.imageSha256.length === 64 &&
    compositeOutput.tags.includes("runtime_compositor_from_ai_visual_units") &&
    compositeOutput.tags.includes(WORLD_FORMAL_JUDGE_REQUIRED_TAG) &&
    runtimeFrame.worldPageContract.canShowInWorld === true &&
    runtimeFrame.composition.compositionStatus.canEnterWorld === true &&
    runtimeFrame.composition.tags.includes(WORLD_DISPLAY_REQUIRED_TAG) &&
    runtimeFrame.tags.includes(WORLD_DISPLAY_REQUIRED_TAG) &&
    !runtimeFrame.tags.includes("structured_fallback_runtime_frame") &&
    !runtimeFrame.tags.includes("single_approved_visual_layer") &&
    !runtimeFrame.tags.includes("training_candidate") &&
    !runtimeFrame.tags.includes("partial_or_crop_candidate") &&
    !runtimeFrame.tags.includes("candidate_only") &&
    !runtimeFrame.tags.includes("single_model_output_only")
  )
}

function buildWorldRuntimeMarkers(
  runtimeFrame: GameMapRuntimeFrame
): WorldRuntimeSurfaceMarker[] {
  const homeCenter = findRegionCenter(runtimeFrame, "walkable-home-center-buffer")
  const entryPoint = findEntryPoint(runtimeFrame)
  const markers: WorldRuntimeSurfaceMarker[] = []

  if (entryPoint) {
    markers.push({
      id: "player-entry-marker",
      label: "入口",
      kind: "entry",
      x: entryPoint.x,
      y: entryPoint.y,
    })
  }

  if (homeCenter) {
    markers.push({
      id: "home-center-marker",
      label: "家园中心",
      kind: "home_center",
      x: homeCenter.x,
      y: homeCenter.y,
    })
  }

  return markers
}

function buildWorldRuntimeInteractions(
  runtimeFrame: GameMapRuntimeFrame
): WorldRuntimeSurfaceInteraction[] {
  const objectsBySourceId = new Map(
    runtimeFrame.layers.objects.map((object) => [object.sourceObjectId, object])
  )

  return runtimeFrame.layers.interactions.map((interaction) => {
    const object = objectsBySourceId.get(interaction.sourceObjectId)
    const kind = object?.kind ?? "unknown"

    return {
      id: interaction.id,
      sourceObjectId: interaction.sourceObjectId,
      label: labelInteractionKind(kind),
      objectKind: kind,
      bounds: interaction.bounds,
      blocksMovement: object?.blocksMovement ?? false,
    }
  })
}

function findRegionCenter(
  runtimeFrame: GameMapRuntimeFrame,
  regionId: string
): { x: number; y: number } | null {
  const region = runtimeFrame.layers.walkable.find((item) => item.id === regionId)
  if (!region || region.polygon.length === 0) return null

  const total = region.polygon.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  )

  return {
    x: total.x / region.polygon.length,
    y: total.y / region.polygon.length,
  }
}

function findEntryPoint(runtimeFrame: GameMapRuntimeFrame): { x: number; y: number } | null {
  const entryRegion =
    runtimeFrame.layers.walkable.find((region) =>
      region.id.includes("entry-to-home")
    ) ?? runtimeFrame.layers.walkable[0]

  if (!entryRegion || entryRegion.polygon.length === 0) return null

  const lowestPoints = [...entryRegion.polygon]
    .sort((left, right) => right.y - left.y)
    .slice(0, 2)

  const total = lowestPoints.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 }
  )

  return {
    x: total.x / lowestPoints.length,
    y: total.y / lowestPoints.length,
  }
}

function labelInteractionKind(kind: string): string {
  if (kind === "tree") return "树木"
  if (kind === "rock") return "岩石"
  if (kind === "shrub") return "灌木"
  if (kind === "flower_patch") return "花丛"
  if (kind === "grass_detail") return "草地"
  return "可查看对象"
}

async function readOwnerRuntimeFrameReviewGate(
  runtimeFrame: GameMapRuntimeFrame
): Promise<{ canShow: boolean; warnings: string[] }> {
  const compositeOutput = runtimeFrame.composition.compositeOutput
  if (!compositeOutput) {
    return { canShow: false, warnings: ["composite_output_missing"] }
  }

  const ledgerPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    ".runtime",
    "ai-painter",
    "training-process-ledger",
    "events.jsonl"
  )

  try {
    const raw = await readFile(/* turbopackIgnore: true */ ledgerPath, "utf8")
    const ownerFailures = raw
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map(parseLedgerLine)
      .filter((event): event is OwnerReviewLedgerEvent => {
        return (
          event !== null &&
          event.action === "owner_review_game_map_runtime_frame" &&
          event.status === "failed" &&
          event.archiveId === runtimeFrame.runtimeFrameId &&
          event.resourceSessionId === compositeOutput.imageSha256
        )
      })
    const ownerPasses = raw
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map(parseLedgerLine)
      .filter((event): event is OwnerReviewLedgerEvent => {
        return (
          event !== null &&
          event.action === "owner_review_game_map_runtime_frame" &&
          isOwnerReviewPassedStatus(event.status) &&
          event.archiveId === runtimeFrame.runtimeFrameId &&
          event.resourceSessionId === compositeOutput.imageSha256
        )
      })

    if (ownerFailures.length > 0) {
      return {
        canShow: false,
        warnings: [
          "owner_final_review_failed",
          ownerFailures.at(-1)?.error ?? "owner_review_failed_visual_not_final",
        ],
      }
    }
    if (ownerPasses.length === 0) {
      return {
        canShow: false,
        warnings: [
          "owner_final_review_pending",
          "owner_review_game_map_runtime_frame_pass_required",
        ],
      }
    }
  } catch {
    return {
      canShow: false,
      warnings: [
        "owner_final_review_ledger_unreadable",
        "owner_review_game_map_runtime_frame_pass_required",
      ],
    }
  }

  return { canShow: true, warnings: [] }
}

type OwnerReviewLedgerEvent = {
  action?: string
  status?: string
  archiveId?: string
  resourceSessionId?: string
  error?: string
}

function isOwnerReviewPassedStatus(status: string | undefined): boolean {
  return status === "success" || status === "passed" || status === "approved"
}

function parseLedgerLine(line: string): OwnerReviewLedgerEvent | null {
  try {
    const value = JSON.parse(line) as OwnerReviewLedgerEvent
    return typeof value === "object" && value !== null ? value : null
  } catch {
    return null
  }
}

function getRuntimeFrameImageSrc(imageUrl: string, imageSha256: string): string {
  if (imageUrl.startsWith("data:image/")) return imageUrl
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl
  return `/api/world/game-map-runtime-frame/image?sha=${encodeURIComponent(imageSha256)}`
}

function GateItem(props: { title: string; children: ReactNode }) {
  return (
    <div style={pageStyles.metaItem}>
      <span style={pageStyles.metaLabel}>{props.title}</span>
      {props.children}
    </div>
  )
}

const pageStyles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#06120e",
    color: "#dfffe7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  panel: {
    width: "min(980px, calc(100vw - 48px))",
    border: "1px solid rgba(153, 255, 194, 0.18)",
    background: "rgba(9, 28, 21, 0.92)",
    padding: 28,
  },
  brand: {
    color: "#8fdcaa",
    fontSize: 13,
    letterSpacing: "0.08em",
    fontWeight: 700,
    marginBottom: 16,
  },
  tick: {
    color: "#f0f5a9",
    fontSize: 14,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    lineHeight: 1.25,
    margin: "0 0 14px",
    fontWeight: 500,
  },
  body: {
    color: "#b8dec6",
    fontSize: 15,
    lineHeight: 1.8,
    margin: "0 0 10px",
  },
  link: {
    display: "inline-block",
    marginTop: 18,
    color: "#06120e",
    background: "#8df0a8",
    padding: "10px 16px",
    textDecoration: "none",
    fontWeight: 700,
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 26,
  },
  metaItem: {
    border: "1px solid rgba(153, 255, 194, 0.16)",
    background: "rgba(12, 38, 28, 0.88)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  metaLabel: {
    color: "#7eb890",
    fontSize: 12,
    textTransform: "uppercase",
  },
}
