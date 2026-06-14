"use client"

import { MouseEvent, useEffect, useMemo, useState } from "react"
import { CONDITION_CHANNELS_V1 } from "./ai-painter-lab-data"
import { SceneReviewPanelV1 } from "./scene-review-panel-v1"
import type { Point, SceneBlueprintV1, SceneDatasetItem, V1Structure, V1StructureType } from "./scene-annotation-types"
import styles from "./page.module.css"

const EDITABLE_TYPES = CONDITION_CHANNELS_V1.map((item) => item.id) as V1StructureType[]
const DEFAULT_VISIBLE = Object.fromEntries(EDITABLE_TYPES.map((item) => [item, true])) as Record<V1StructureType, boolean>
const LINE_TYPES = new Set<V1StructureType>(["road_center", "road_edge", "shoreline"])
const POLYGON_TYPES = new Set<V1StructureType>([
  "grass",
  "water_body",
  "tree_crown",
  "rock",
  "shelter_foundation",
  "shelter_wall",
  "shelter_roof",
  "construction_material",
  "walkable",
  "depth",
])

type DrawingMode = "polyline" | "polygon" | "rect"

export function SceneAnnotationEditorV1() {
  const [scenes, setScenes] = useState<SceneDatasetItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [blueprint, setBlueprint] = useState<SceneBlueprintV1 | null>(null)
  const [tool, setTool] = useState<V1StructureType>("road_center")
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [boxStart, setBoxStart] = useState<Point | null>(null)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [lineWidth, setLineWidth] = useState(8)
  const [status, setStatus] = useState("正在读取 V1 场景草稿……")
  const [saving, setSaving] = useState(false)

  useEffect(() => { void loadScenes() }, [])
  const scene = useMemo(() => scenes.find((item) => item.sampleId === selectedId) ?? null, [scenes, selectedId])
  const visibleStructures = (blueprint?.structures ?? []).filter((item) => visible[item.type])
  const drawingMode = drawingModeFor(tool)
  const usesPointTool = drawingMode !== "rect"

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
    resetDraft()
    setStatus(next.blueprintV1 ? "已读取 V1 草稿。请选择标注类型。" : "当前场景尚未迁移，请先生成 V1 草稿。")
  }

  function changeTool(nextTool: V1StructureType) {
    setTool(nextTool)
    resetDraft()
    setStatus(toolInstruction(nextTool))
  }

  async function migrate() {
    if (!selectedId) return
    setSaving(true)
    setStatus("正在从 V0 生成 V1 草稿和 14 通道 Mask……")
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
    if (!blueprint || event.detail > 1) return
    const point = canvasPoint(event)
    if (usesPointTool) {
      setDraftPoints((current) => [...current, point])
      setStatus(drawingMode === "polygon"
        ? "已增加多边形节点。请沿真实边缘继续点击，完成后闭合区域。"
        : "已增加折线节点。继续点击延伸，完成后点击“完成折线”。")
      return
    }
    if (!boxStart) {
      setBoxStart(point)
      setStatus("已确定左上角，请点击右下角。")
      return
    }
    const structure = createRectStructure(tool, boxStart, point, blueprint.structures.length + 1)
    setBlueprint({ ...blueprint, structures: [...blueprint.structures, structure], requiresManualReview: true })
    setBoxStart(null)
    setStatus(`已添加 ${labelFor(tool)}，保存后服务端会重新校验并生成 Mask。`)
  }

  function finishPointShape() {
    if (!blueprint || !usesPointTool) return
    const minimumPoints = drawingMode === "polygon" ? 3 : 2
    if (draftPoints.length < minimumPoints) {
      setStatus(drawingMode === "polygon" ? "多边形至少需要三个节点。" : "折线至少需要两个节点。")
      return
    }
    const structure = drawingMode === "polygon"
      ? createPolygonStructure(tool, draftPoints, blueprint.structures.length + 1)
      : createLineStructure(tool, draftPoints, lineWidth, blueprint.structures.length + 1)
    setBlueprint({ ...blueprint, structures: [...blueprint.structures, structure], requiresManualReview: true })
    setDraftPoints([])
    setStatus(`已完成 ${labelFor(tool)}。如边界不正确，可从右侧结构列表删除后重画。`)
  }

  function undoDraftPoint() {
    setDraftPoints((current) => current.slice(0, -1))
  }

  function resetDraft() {
    setDraftPoints([])
    setBoxStart(null)
  }

  function removeStructure(id: string) {
    if (!blueprint) return
    setBlueprint({ ...blueprint, structures: blueprint.structures.filter((item) => item.id !== id), requiresManualReview: true })
  }

  function clearType() {
    if (!blueprint) return
    setBlueprint({ ...blueprint, structures: blueprint.structures.filter((item) => item.type !== tool), requiresManualReview: true })
    resetDraft()
    setStatus(`已清除全部 ${labelFor(tool)}，尚未保存。`)
  }

  async function save() {
    if (!blueprint || !selectedId) return
    setSaving(true)
    setStatus("正在保存 V1 Blueprint 并重建 14 通道 Mask……")
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
        <label>标注类型<select value={tool} onChange={(event) => changeTool(event.target.value as V1StructureType)}>{CONDITION_CHANNELS_V1.map((item) => <option key={item.id} value={item.id}>{item.zh}</option>)}</select></label>
        {drawingMode === "polyline" && <label>线宽<input className={styles.lineWidthInput} type="number" min="1" max="48" value={lineWidth} onChange={(event) => setLineWidth(clamp(Number(event.target.value) || 1, 1, 48))} /></label>}
        {usesPointTool && <button type="button" disabled={draftPoints.length < (drawingMode === "polygon" ? 3 : 2)} onClick={finishPointShape}>{drawingMode === "polygon" ? "闭合并完成区域" : "完成折线"}</button>}
        {usesPointTool && <button type="button" disabled={!draftPoints.length} onClick={undoDraftPoint}>撤销上一点</button>}
        <button type="button" disabled={!draftPoints.length && !boxStart} onClick={resetDraft}>取消当前草稿</button>
        <button type="button" disabled={saving} onClick={migrate}>从 V0 生成 V1 草稿</button>
        <button type="button" onClick={clearType}>清除当前标注类型</button>
        <button type="button" disabled={saving} onClick={save}>{saving ? "正在保存" : "保存 V1 并重建 14 Mask"}</button>
      </div>

      <p className={styles.annotationHint}>{toolInstruction(tool)}</p>

      <div className={styles.annotationModeLegend}>
        <span><b>多边形</b> 草地、水体、树冠、岩石、建筑、施工材料、可行走、深度</span>
        <span><b>折线</b> 水岸、道路中心、道路边缘</span>
        <span><b>矩形</b> 树干落点</span>
      </div>

      <div className={styles.toolButtons}>{CONDITION_CHANNELS_V1.map((item) => <button className={visible[item.id] ? styles.activeTool : ""} type="button" key={item.id} onClick={() => setVisible({ ...visible, [item.id]: !visible[item.id] })}>{item.zh}</button>)}</div>
      <div className={styles.annotationWorkspace}>
        <div className={styles.annotationCanvas}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.imageUrl} alt={`${scene.sampleId} 原始训练目标图`} />
          <svg viewBox="0 0 256 192" onClick={annotate} onDoubleClick={finishPointShape} aria-label="V1 场景标注画布">
            {visibleStructures.map((item) => <StructureOverlay key={item.id} item={item} />)}
            {draftPoints.length > 0 && drawingMode === "polyline" && <polyline points={pointsAttribute(draftPoints)} className={styles.editableRoadDraft} style={{ strokeWidth: lineWidth }} />}
            {draftPoints.length > 0 && drawingMode === "polygon" && <polygon points={pointsAttribute(draftPoints)} className={styles.editablePolygonDraft} />}
            {draftPoints.map((point, index) => <circle key={`${point[0]}-${point[1]}-${index}`} cx={point[0]} cy={point[1]} r="1.8" className={styles.draftPoint} />)}
            {boxStart && <circle cx={boxStart[0]} cy={boxStart[1]} r="2" className={styles.draftPoint} />}
          </svg>
        </div>
        <aside className={styles.annotationSummary}>
          <h3>V1 复核状态</h3>
          <p>{blueprint.requiresManualReview ? "需要人工复核，不能进入正式质量训练。" : "仍需服务端确认。"}</p>
          <ul>{blueprint.manualReviewReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p>{status}</p>
          <h3>结构列表</h3>
          <div>{blueprint.structures.map((item) => <button type="button" key={item.id} onClick={() => removeStructure(item.id)}>{item.id} / {item.type}{item.requiresManualReview ? " / 待复核" : ""}</button>)}</div>
          <SceneReviewPanelV1 scene={scene} blueprint={blueprint} onReviewed={() => loadScenes(selectedId)} />
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

function createRectStructure(type: V1StructureType, start: Point, end: Point, index: number): V1Structure {
  const x = Math.min(start[0], end[0])
  const y = Math.min(start[1], end[1])
  return {
    id: `${type}-${index}`, type, layer: index * 10,
    geometry: { kind: "rect", x, y, width: Math.max(1, Math.abs(end[0] - start[0])), height: Math.max(1, Math.abs(end[1] - start[1])) },
    requiresManualReview: true, manualReviewReasons: ["人工编辑结构，需要项目负责人确认"],
    ...(type === "depth" ? { depthValue: 128 } : {}),
  }
}

function createLineStructure(type: V1StructureType, points: Point[], lineWidth: number, index: number): V1Structure {
  return {
    id: `${type}-${index}`, type, layer: index * 10,
    geometry: { kind: "polyline", points: [...points], lineWidth },
    requiresManualReview: true, manualReviewReasons: ["人工绘制折线，需要项目负责人确认"],
  }
}

function createPolygonStructure(type: V1StructureType, points: Point[], index: number): V1Structure {
  return {
    id: `${type}-${index}`, type, layer: index * 10,
    geometry: { kind: "polygon", points: [...points] },
    requiresManualReview: true, manualReviewReasons: ["人工描绘多边形边界，需要项目负责人确认"],
    ...(type === "depth" ? { depthValue: 128 } : {}),
  }
}

function emptyBlueprintV1(scene: SceneDatasetItem): SceneBlueprintV1 {
  return { schemaVersion: "world-blueprint-v1", sceneId: scene.sampleId, width: 256, height: 192, seed: scene.blueprint.seed, styleId: scene.blueprint.styleId, requiresManualReview: true, manualReviewReasons: ["尚未从 V0 自动迁移"], structures: [] }
}

function canvasPoint(event: MouseEvent<SVGSVGElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect()
  return [clamp(Math.round((event.clientX - rect.left) / rect.width * 256), 0, 255), clamp(Math.round((event.clientY - rect.top) / rect.height * 192), 0, 191)]
}

function labelFor(type: V1StructureType) { return CONDITION_CHANNELS_V1.find((item) => item.id === type)?.zh ?? type }
function channelColor(type: V1StructureType) { return CONDITION_CHANNELS_V1.find((item) => item.id === type)?.color ?? "#fff06a" }
function drawingModeFor(type: V1StructureType): DrawingMode {
  if (LINE_TYPES.has(type)) return "polyline"
  if (POLYGON_TYPES.has(type)) return "polygon"
  return "rect"
}
function toolInstruction(type: V1StructureType) {
  const mode = drawingModeFor(type)
  if (mode === "polyline") return `折线工具：沿${labelFor(type)}依次点击；转弯处增加节点，完成后点击“完成折线”。`
  if (mode === "polygon") return `多边形工具：沿${labelFor(type)}的真实可见边缘逐点描绘，至少三个点，再点击“闭合并完成区域”。`
  return `矩形工具：框选${labelFor(type)}的单个真实对象；先点击左上角，再点击右下角。`
}
function pointsAttribute(points: Point[]) { return points.map((point) => point.join(",")).join(" ") }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)) }
