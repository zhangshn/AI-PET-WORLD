"use client"

import { MouseEvent, useEffect, useMemo, useState } from "react"
import { CONDITION_CHANNELS_V1 } from "./ai-painter-lab-data"
import type { Point, SceneBlueprintV1, SceneDatasetItem, V1Structure, V1StructureType } from "./scene-annotation-types"
import styles from "./page.module.css"

const EDITABLE_TYPES = CONDITION_CHANNELS_V1.map((item) => item.id) as V1StructureType[]
const DEFAULT_VISIBLE = Object.fromEntries(EDITABLE_TYPES.map((item) => [item, true])) as Record<V1StructureType, boolean>

export function SceneAnnotationEditorV1() {
  const [scenes, setScenes] = useState<SceneDatasetItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [blueprint, setBlueprint] = useState<SceneBlueprintV1 | null>(null)
  const [tool, setTool] = useState<V1StructureType>("water_body")
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [boxStart, setBoxStart] = useState<Point | null>(null)
  const [status, setStatus] = useState("正在读取 v1 场景草案...")
  const [saving, setSaving] = useState(false)

  useEffect(() => { void loadScenes() }, [])
  const scene = useMemo(() => scenes.find((item) => item.sampleId === selectedId) ?? null, [scenes, selectedId])
  const visibleStructures = (blueprint?.structures ?? []).filter((item) => visible[item.type])

  async function loadScenes(preferredId?: string) {
    const response = await fetch("/api/ai-painter/dataset/scenes", { cache: "no-store" })
    const result = await response.json() as { ok: boolean; scenes?: SceneDatasetItem[]; message?: string }
    if (!result.ok || !result.scenes?.length) {
      setStatus(result.message ?? "当前没有可编辑的完整场景。")
      return
    }
    setScenes(result.scenes)
    selectScene(result.scenes, preferredId ?? result.scenes[0].sampleId)
  }

  function selectScene(source: SceneDatasetItem[], sampleId: string) {
    const next = source.find((item) => item.sampleId === sampleId)
    if (!next) return
    setSelectedId(sampleId)
    setBlueprint(next.blueprintV1 ? structuredClone(next.blueprintV1) : emptyBlueprintV1(next))
    setBoxStart(null)
    setStatus(next.blueprintV1 ? "已读取 v1 草案。" : "当前场景尚未迁移，请先生成 v1 草案。")
  }

  async function migrate() {
    if (!selectedId) return
    setSaving(true)
    setStatus("正在从 v0 生成 v1 草案和 14 张 Mask...")
    try {
      const response = await fetch(`/api/ai-painter/dataset/scenes/${selectedId}/migrate-v1`, { method: "POST" })
      const result = await response.json() as { ok: boolean; message: string }
      setStatus(result.message)
      await loadScenes(selectedId)
    } finally {
      setSaving(false)
    }
  }

  function annotate(event: MouseEvent<SVGSVGElement>) {
    if (!blueprint) return
    const point = canvasPoint(event)
    if (!boxStart) {
      setBoxStart(point)
      setStatus("已确定左上角，请点击右下角。")
      return
    }
    const structure = createRectStructure(tool, boxStart, point, blueprint.structures.length + 1)
    setBlueprint({ ...blueprint, structures: [...blueprint.structures, structure], requiresManualReview: true })
    setBoxStart(null)
    setStatus(`已添加 ${tool}，保存后服务端会重新校验并生成 Mask。`)
  }

  function removeStructure(id: string) {
    if (!blueprint) return
    setBlueprint({ ...blueprint, structures: blueprint.structures.filter((item) => item.id !== id), requiresManualReview: true })
  }

  function clearType() {
    if (!blueprint) return
    setBlueprint({ ...blueprint, structures: blueprint.structures.filter((item) => item.type !== tool), requiresManualReview: true })
  }

  async function save() {
    if (!blueprint || !selectedId) return
    setSaving(true)
    setStatus("正在保存 v1 Blueprint 并重建 14 通道 Mask...")
    try {
      const response = await fetch(`/api/ai-painter/dataset/scenes/${selectedId}/annotation-v1`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(blueprint),
      })
      const result = await response.json() as { ok: boolean; message: string }
      setStatus(result.message)
      if (result.ok) await loadScenes(selectedId)
    } finally {
      setSaving(false)
    }
  }

  if (!scene || !blueprint) return <p className={styles.annotationEmpty}>{status}</p>

  return (
    <div className={styles.annotationEditor}>
      <div className={styles.annotationToolbar}>
        <label>当前场景<select value={selectedId} onChange={(event) => selectScene(scenes, event.target.value)}>{scenes.map((item) => <option key={item.sampleId}>{item.sampleId}</option>)}</select></label>
        <label>结构类型<select value={tool} onChange={(event) => setTool(event.target.value as V1StructureType)}>{CONDITION_CHANNELS_V1.map((item) => <option key={item.id} value={item.id}>{item.zh}</option>)}</select></label>
        <button type="button" disabled={saving} onClick={migrate}>从 v0 生成 v1 草案</button>
        <button type="button" onClick={clearType}>清空当前结构类型</button>
        <button type="button" disabled={saving} onClick={save}>{saving ? "正在保存" : "保存 v1 并重建 14 Mask"}</button>
      </div>
      <div className={styles.toolButtons}>{CONDITION_CHANNELS_V1.map((item) => <button className={visible[item.id] ? styles.activeTool : ""} type="button" key={item.id} onClick={() => setVisible({ ...visible, [item.id]: !visible[item.id] })}>{item.zh}</button>)}</div>
      <div className={styles.annotationWorkspace}>
        <div className={styles.annotationCanvas}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.imageUrl} alt={`${scene.sampleId} 原始训练目标图`} />
          <svg viewBox="0 0 256 192" onClick={annotate} aria-label="v1 场景标注画布">
            {visibleStructures.map((item) => <StructureOverlay key={item.id} item={item} />)}
            {boxStart && <circle cx={boxStart[0]} cy={boxStart[1]} r="2" className={styles.draftPoint} />}
          </svg>
        </div>
        <aside className={styles.annotationSummary}>
          <h3>v1 复核状态</h3>
          <p>{blueprint.requiresManualReview ? "需要人工复核，不能进入正式质量训练。" : "仍需服务端确认。"}</p>
          <ul>{blueprint.manualReviewReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p>{status}</p>
          <h3>结构列表</h3>
          <div>{blueprint.structures.map((item) => <button type="button" key={item.id} onClick={() => removeStructure(item.id)}>{item.id} / {item.type}{item.requiresManualReview ? " / 待复核" : ""}</button>)}</div>
        </aside>
      </div>
    </div>
  )
}

function StructureOverlay({ item }: { item: V1Structure }) {
  if (item.geometry.kind === "rect") return <rect x={item.geometry.x} y={item.geometry.y} width={item.geometry.width} height={item.geometry.height} className={item.requiresManualReview ? styles.draftShape : styles.grassRegion} />
  if (item.geometry.kind === "polygon") return <polygon points={pointsAttribute(item.geometry.points)} className={styles.draftShape} />
  return <polyline points={pointsAttribute(item.geometry.points)} className={styles.roadLine} style={{ strokeWidth: item.geometry.lineWidth }} />
}

function createRectStructure(type: V1StructureType, start: Point, end: Point, index: number): V1Structure {
  const x = Math.min(start[0], end[0])
  const y = Math.min(start[1], end[1])
  return {
    id: `${type}-${index}`, type, layer: index * 10,
    geometry: { kind: "rect", x, y, width: Math.max(1, Math.abs(end[0] - start[0])), height: Math.max(1, Math.abs(end[1] - start[1])) },
    requiresManualReview: true, manualReviewReasons: ["人工编辑结构，需项目负责人确认"],
    ...(type === "depth" ? { depthValue: 128 } : {}),
  }
}

function emptyBlueprintV1(scene: SceneDatasetItem): SceneBlueprintV1 {
  return { schemaVersion: "world-blueprint-v1", sceneId: scene.sampleId, width: 256, height: 192, seed: scene.blueprint.seed, styleId: scene.blueprint.styleId, requiresManualReview: true, manualReviewReasons: ["尚未从 v0 自动迁移"], structures: [] }
}

function canvasPoint(event: MouseEvent<SVGSVGElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect()
  return [clamp(Math.round((event.clientX - rect.left) / rect.width * 256), 0, 255), clamp(Math.round((event.clientY - rect.top) / rect.height * 192), 0, 191)]
}
function pointsAttribute(points: Point[]) { return points.map((point) => point.join(",")).join(" ") }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)) }
