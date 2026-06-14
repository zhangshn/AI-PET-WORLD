"use client"

import { useEffect, useMemo, useState } from "react"
import { CONDITION_CHANNELS_V1 } from "./ai-painter-lab-data"
import type { Point, SceneBlueprintV1, SceneDatasetItem, V1Structure, V1StructureType } from "./scene-annotation-types"
import styles from "./page.module.css"

const CHANNEL_TYPES = CONDITION_CHANNELS_V1.map((item) => item.id) as V1StructureType[]
const DEFAULT_VISIBLE = Object.fromEntries(CHANNEL_TYPES.map((item) => [item, true])) as Record<V1StructureType, boolean>

export function SceneAnnotationEditorV1() {
  const [scenes, setScenes] = useState<SceneDatasetItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [blueprint, setBlueprint] = useState<SceneBlueprintV1 | null>(null)
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [status, setStatus] = useState("正在读取模块 D 自动标注结果……")

  useEffect(() => { void loadAutomaticScenes() }, [])
  const scene = useMemo(() => scenes.find((item) => item.sampleId === selectedId) ?? null, [scenes, selectedId])
  const visibleStructures = (blueprint?.structures ?? []).filter((item) => visible[item.type])
  const grouped = useMemo(() => groupStructures(blueprint?.structures ?? []), [blueprint])

  async function loadAutomaticScenes(preferredId?: string) {
    const response = await fetch("/api/ai-painter/dataset/auto-annotations", { cache: "no-store" })
    const result = await response.json() as { ok: boolean; scenes?: SceneDatasetItem[]; message?: string }
    if (!result.ok || !result.scenes?.length) {
      setScenes([])
      setSelectedId("")
      setBlueprint(null)
      setStatus(result.message ?? "当前没有模块 D 自动标注结果。")
      return
    }
    setScenes(result.scenes)
    selectScene(result.scenes, preferredId ?? result.scenes[0].sampleId)
  }

  function selectScene(source: SceneDatasetItem[], sampleId: string) {
    const next = source.find((item) => item.sampleId === sampleId)
    if (!next?.blueprintV1) return
    setSelectedId(sampleId)
    setBlueprint(structuredClone(next.blueprintV1))
    setStatus("已读取模块 D 自动标注结果；当前页面不再展示旧 V0/V1 示例标注。")
  }

  if (!scene || !blueprint) return <p className={styles.annotationEmpty}>{status}</p>

  return (
    <div className={styles.annotationEditor}>
      <div className={styles.annotationToolbar}>
        <label>自动标注样本<select value={selectedId} onChange={(event) => selectScene(scenes, event.target.value)}>{scenes.map((item) => <option key={item.sampleId}>{item.sampleId}</option>)}</select></label>
        <button type="button" onClick={() => loadAutomaticScenes(selectedId)}>重新读取模块 D 结果</button>
        <span>只读展示：来源为 `accepted/dataset_v1` 的自动标注结果</span>
      </div>

      <p className={styles.annotationHint}>{status}</p>

      <div className={styles.annotationModeLegend}>
        <span><b>当前展示</b> 自动识别结构、自动派生结构、Judge 已通过的训练准入结果</span>
        <span><b>已隐藏</b> 原来的 V0 迁移草稿、人工示例标注、页面手动画线工具</span>
      </div>

      <div className={styles.toolButtons}>{CONDITION_CHANNELS_V1.map((item) => <button className={visible[item.id] ? styles.activeTool : ""} type="button" key={item.id} onClick={() => setVisible({ ...visible, [item.id]: !visible[item.id] })}>{item.zh}</button>)}</div>
      <div className={styles.annotationWorkspace}>
        <div className={styles.annotationCanvas}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.imageUrl} alt={`${scene.sampleId} 模块 D 自动标注原图`} />
          <svg viewBox="0 0 256 192" aria-label="模块 D 自动标注结果画布">
            {visibleStructures.map((item) => <StructureOverlay key={item.id} item={item} />)}
          </svg>
        </div>
        <aside className={styles.annotationSummary}>
          <h3>模块 D 自动标注状态</h3>
          <p>{scene.judge?.status === "passed" ? "Annotation Judge 已通过，允许进入正式 accepted/index。" : "当前样本没有通过 Judge，不能进入正式训练。"}</p>
          <p>结构数量：{blueprint.structures.length}</p>
          <p>Blueprint Hash：{scene.blueprintV1Hash ?? "未记录"}</p>
          <p>原图 Hash：{scene.targetImageHash ?? "未记录"}</p>
          <h3>14 通道结构计数</h3>
          <div>{CONDITION_CHANNELS_V1.map((item) => <button type="button" key={item.id} onClick={() => setVisible({ ...visible, [item.id]: !visible[item.id] })}>{item.zh} / {grouped[item.id] ?? 0}</button>)}</div>
          <h3>自动结构列表</h3>
          <div>{blueprint.structures.map((item) => <button type="button" key={item.id}>{item.id} / {labelFor(item.type)}{typeof item.confidence === "number" ? ` / ${Math.round(item.confidence * 100)}%` : ""}</button>)}</div>
          {!!scene.judge?.errors?.length && <ul>{scene.judge.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
        </aside>
      </div>
    </div>
  )
}

function StructureOverlay({ item }: { item: V1Structure }) {
  const color = channelColor(item.type)
  const commonStyle = { stroke: color }
  if (item.geometry.kind === "rect") return <rect x={item.geometry.x} y={item.geometry.y} width={item.geometry.width} height={item.geometry.height} className={styles.channelRect} style={{ ...commonStyle, fill: `${color}38` }} />
  if (item.geometry.kind === "polygon") return <polygon points={pointsAttribute(item.geometry.points)} className={styles.channelPolygon} style={{ ...commonStyle, fill: `${color}30` }} />
  return <polyline points={pointsAttribute(item.geometry.points)} className={styles.roadLine} style={{ ...commonStyle, strokeWidth: item.geometry.lineWidth }} />
}

function groupStructures(items: V1Structure[]) {
  return items.reduce((result, item) => {
    result[item.type] = (result[item.type] ?? 0) + 1
    return result
  }, {} as Partial<Record<V1StructureType, number>>)
}

function labelFor(type: V1StructureType) { return CONDITION_CHANNELS_V1.find((item) => item.id === type)?.zh ?? type }
function channelColor(type: V1StructureType) { return CONDITION_CHANNELS_V1.find((item) => item.id === type)?.color ?? "#fff06a" }
function pointsAttribute(points: Point[]) { return points.map((point) => point.join(",")).join(" ") }
